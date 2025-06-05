import { useState, useEffect } from "react";
import {
    Box,
    Card,
    CardBody,
    CardHeader,
    Heading,
    Text,
    Badge,
    Button,
    VStack,
    HStack,
    Progress,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Divider,
    useToast,
    Icon
} from "@chakra-ui/react";
import { FaHeart, FaClock, FaEthereum, FaUser, FaShieldAlt, FaCheckCircle } from "react-icons/fa";
import { ethers } from "ethers";
import smartWillAbi from "../contracts/SmartWill.json";

interface Props {
    signer: ethers.Signer;
    willAddress: string;
}

interface WillInfo {
    owner: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: bigint;
    balance: bigint;
    isOwnerActive: boolean;
    lastActivity: bigint;
    willActivateWaitingPeriod: bigint;
    transferFrequency: bigint;
    nextPossibleTransferTime: bigint;
    canTransferNow: boolean;
}

export default function HeirDashboard({ signer, willAddress }: Props) {
    const [willInfo, setWillInfo] = useState<WillInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [countdown, setCountdown] = useState<string>("");
    const [ownerActivityCountdown, setOwnerActivityCountdown] = useState<string>("");

    const toast = useToast();

    const loadWillInfo = async () => {
        try {
            setLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);

            const [
                owner,
                heir,
                heirName,
                heirRole,
                transferAmount,
                balance,
                isOwnerActive,
                lastActivity,
                willActivateWaitingPeriod,
                transferFrequency,
                nextPossibleTransferTime,
                canTransferNow
            ] = await Promise.all([
                will.owner(),
                will.heir(),
                will.heirName(),
                will.heirRole(),
                will.transferAmount(),
                will.getBalance(),
                will.isOwnerActive(),
                will.lastActivity(),
                will.willActivateWaitingPeriod(),
                will.transferFrequency(),
                will.getNextPossibleTransferTime(),
                will.canTransferNow()
            ]);

            setWillInfo({
                owner,
                heir,
                heirName,
                heirRole,
                transferAmount,
                balance,
                isOwnerActive,
                lastActivity,
                willActivateWaitingPeriod,
                transferFrequency,
                nextPossibleTransferTime,
                canTransferNow
            });

        } catch (error: any) {
            toast({
                title: "Loading Error",
                description: error.message,
                status: "error",
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateCountdowns = () => {
        if (!willInfo) return;

        const currentTime = Math.floor(Date.now() / 1000);

        // Time until next possible transfer
        const timeUntilTransfer = Number(willInfo.nextPossibleTransferTime) - currentTime;

        // Time until owner inactivity
        const timeUntilOwnerInactive = Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod) - currentTime;

        if (timeUntilTransfer > 0) {
            const hours = Math.floor(timeUntilTransfer / 3600);
            const minutes = Math.floor((timeUntilTransfer % 3600) / 60);
            const seconds = timeUntilTransfer % 60;

            if (hours > 0) {
                setCountdown(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setCountdown(`${minutes}m ${seconds}s`);
            } else {
                setCountdown(`${seconds}s`);
            }
        } else {
            setCountdown("Available!");
        }

        if (willInfo.isOwnerActive && timeUntilOwnerInactive > 0) {
            const hours = Math.floor(timeUntilOwnerInactive / 3600);
            const minutes = Math.floor((timeUntilOwnerInactive % 3600) / 60);
            const seconds = timeUntilOwnerInactive % 60;

            if (hours > 0) {
                setOwnerActivityCountdown(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setOwnerActivityCountdown(`${minutes}m ${seconds}s`);
            } else {
                setOwnerActivityCountdown(`${seconds}s`);
            }
        } else {
            setOwnerActivityCountdown("Inactive");
        }
    };

    const executeTransfer = async () => {
        if (!willInfo) return;

        try {
            setTransferLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);

            const tx = await will.transferToHeir();

            toast({
                title: "Transaction Sent",
                description: "Executing funds transfer...",
                status: "info",
                duration: 3000
            });

            await tx.wait();

            toast({
                title: "✅ Funds Received!",
                description: `You received ${ethers.formatEther(willInfo.transferAmount)} ETH`,
                status: "success",
                duration: 5000
            });

            // Update information
            loadWillInfo();

        } catch (error: any) {
            let errorMessage = error.message;

            if (error.message.includes("Owner is still active")) {
                errorMessage = "Owner is still active. Wait for the waiting period to end.";
            } else if (error.message.includes("Transfer frequency limit")) {
                errorMessage = "Not enough time has passed since the last transfer.";
            } else if (error.message.includes("Not enough balance")) {
                errorMessage = "Insufficient funds in the will.";
            }

            toast({
                title: "Transfer Error",
                description: errorMessage,
                status: "error",
                duration: 5000
            });
        } finally {
            setTransferLoading(false);
        }
    };

    useEffect(() => {
        loadWillInfo();
    }, [willAddress]);

    useEffect(() => {
        if (willInfo) {
            calculateCountdowns();
            const interval = setInterval(calculateCountdowns, 1000);
            return () => clearInterval(interval);
        }
    }, [willInfo]);

    if (loading) {
        return (
            <Box textAlign="center" py={10}>
                <Text>Loading inheritance information...</Text>
            </Box>
        );
    }

    if (!willInfo) {
        return (
            <Alert status="error">
                <AlertIcon />
                <AlertTitle>Error!</AlertTitle>
                <AlertDescription>Unable to load inheritance information</AlertDescription>
            </Alert>
        );
    }

    const progressValue = willInfo.isOwnerActive
        ? ((Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod) - Math.floor(Date.now() / 1000)) / Number(willInfo.willActivateWaitingPeriod)) * 100
        : 0;

    return (
        <VStack spacing={6} align="stretch">
            {/* Header */}
            <Card bg="white">
                <CardHeader>
                    <HStack>
                        <Icon as={FaHeart} color="red.500" boxSize={6} />
                        <VStack align="start" spacing={0}>
                            <Heading size="lg">My Inheritance</Heading>
                            <Text>
                                Will: {willAddress.slice(0, 6)}...{willAddress.slice(-4)}
                            </Text>
                        </VStack>
                    </HStack>
                </CardHeader>
            </Card>

            {/* Owner status */}
            <Card bg="white">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaUser} color={willInfo.isOwnerActive ? "green.500" : "red.500"} />
                                <Text fontWeight="semibold">Owner Status</Text>
                            </HStack>
                            <Badge
                                colorScheme={willInfo.isOwnerActive ? "green" : "red"}
                                size="lg"
                                px={3}
                                py={1}
                            >
                                {willInfo.isOwnerActive ? "🟢 Active" : "🔴 Inactive"}
                            </Badge>
                        </HStack>

                        {willInfo.isOwnerActive && (
                            <Box width="100%">
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="sm" color="gray.600">Owner activity expires in:</Text>
                                    <Text fontSize="sm" fontWeight="semibold" color="green.500">
                                        {ownerActivityCountdown}
                                    </Text>
                                </HStack>
                                <Progress
                                    value={progressValue}
                                    colorScheme="green"
                                    size="lg"
                                    borderRadius="lg"
                                />
                                <Text fontSize="xs" color="gray.600" mt={1} textAlign="center">
                                    Last activity: {new Date(Number(willInfo.lastActivity) * 1000).toLocaleString()}
                                </Text>
                            </Box>
                        )}

                        {willInfo.isOwnerActive && (
                            <Alert status="info" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>ℹ️ Owner Active</AlertTitle>
                                    <AlertDescription>
                                        You can only receive payments when the owner becomes inactive.
                                        This will happen in {ownerActivityCountdown}, if he doesn't confirm his activity.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}

                        {!willInfo.isOwnerActive && (
                            <Alert status="success" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>✅ Owner Inactive!</AlertTitle>
                                    <AlertDescription>
                                        The owner didn't confirm activity for more than {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} minutes.
                                        You can receive periodic payments.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}
                    </VStack>
                </CardBody>
            </Card>

            {/* Will information */}
            <Card bg="white">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaEthereum} color="blue.500" />
                                <Text fontWeight="semibold">Will Information</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color="gray.600">Your Name:</Text>
                                <Text fontWeight="semibold">{willInfo.heirName}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Your Role:</Text>
                                <Text fontWeight="semibold">{willInfo.heirRole}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Payment Amount:</Text>
                                <Text fontWeight="semibold" color="green.500">{ethers.formatEther(willInfo.transferAmount)} ETH</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Payment Frequency:</Text>
                                <Text fontWeight="semibold">Every {Math.floor(Number(willInfo.transferFrequency) / 60)} minutes</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Will Balance:</Text>
                                <Text fontWeight="semibold" color="blue.500">{ethers.formatEther(willInfo.balance)} ETH</Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Funds receiving status */}
            <Card bg={willInfo.canTransferNow ? "green.500" : "yellow.500"} borderWidth="2px">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={willInfo.canTransferNow ? FaCheckCircle : FaClock} color={willInfo.canTransferNow ? "green.500" : "yellow.500"} />
                                <Text fontWeight="semibold">Funds Receiving</Text>
                            </HStack>
                            <Badge
                                colorScheme={willInfo.canTransferNow ? "green" : "yellow"}
                                size="lg"
                                px={3}
                                py={1}
                            >
                                {willInfo.canTransferNow ? "✅ Available" : "⏳ Waiting"}
                            </Badge>
                        </HStack>

                        {!willInfo.canTransferNow && (
                            <Box width="100%">
                                <Text fontSize="sm" color="gray.600" mb={2} textAlign="center">
                                    Next transfer will be available in:
                                </Text>
                                <Text fontSize="2xl" fontWeight="bold" textAlign="center" color="yellow.500">
                                    {countdown}
                                </Text>
                                <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                                    Transfer time: {new Date(Number(willInfo.nextPossibleTransferTime) * 1000).toLocaleString()}
                                </Text>
                            </Box>
                        )}

                        {willInfo.canTransferNow && (
                            <Box width="100%">
                                <Text fontSize="lg" fontWeight="bold" textAlign="center" color="green.500" mb={4}>
                                    🎉 You can receive funds!
                                </Text>

                                <Button
                                    colorScheme="green"
                                    size="xl"
                                    width="100%"
                                    py={6}
                                    onClick={executeTransfer}
                                    isLoading={transferLoading}
                                    leftIcon={<Icon as={FaEthereum} />}
                                    fontSize="lg"
                                    fontWeight="bold"
                                    borderRadius="xl"
                                    loadingText="Transferring..."
                                    _hover={{
                                        transform: "translateY(-2px)",
                                        boxShadow: "xl"
                                    }}
                                    isDisabled={Number(willInfo.balance) < Number(willInfo.transferAmount)}
                                >
                                    💰 Receive {ethers.formatEther(willInfo.transferAmount)} ETH
                                </Button>

                                {Number(willInfo.balance) < Number(willInfo.transferAmount) && (
                                    <Alert status="warning" borderRadius="lg" mt={4}>
                                        <AlertIcon />
                                        <AlertDescription>
                                            Insufficient funds in the will for transfer
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </Box>
                        )}

                        <Divider />

                        <Alert status="info" borderRadius="lg">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>ℹ️ How the system works</AlertTitle>
                                <AlertDescription fontSize="sm">
                                    <VStack align="start" spacing={1}>
                                        <Text>• The owner must regularly confirm activity</Text>
                                        <Text>• If he doesn't do this {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} minutes - he becomes inactive</Text>
                                        <Text>• After the owner becomes inactive, you can receive payments</Text>
                                        <Text>• Payments are available every {Math.floor(Number(willInfo.transferFrequency) / 60)} minutes</Text>
                                        <Text>• If the owner confirms activity again - you will have to wait for a new period</Text>
                                    </VStack>
                                </AlertDescription>
                            </Box>
                        </Alert>
                    </VStack>
                </CardBody>
            </Card>

            {/* Update data */}
            <Box textAlign="center">
                <Button
                    variant="outline"
                    onClick={loadWillInfo}
                    isLoading={loading}
                    leftIcon={<Icon as={FaShieldAlt} />}
                >
                    Update Data
                </Button>
            </Box>
        </VStack>
    );
}