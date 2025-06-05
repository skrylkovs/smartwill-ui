import { useState, useEffect } from "react";
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Heading,
    useColorModeValue,
    Icon,
    Badge,
    useToast,
    Card,
    CardBody,
    CardHeader,
    Progress
} from "@chakra-ui/react";
import { FaHeart, FaClock, FaEthereum, FaUser, FaShieldAlt, FaCheck } from "react-icons/fa";
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
}

export default function OwnerDashboard({ signer, willAddress }: Props) {
    const [willInfo, setWillInfo] = useState<WillInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [timeUntilInactive, setTimeUntilInactive] = useState<number>(0);
    const [countdown, setCountdown] = useState<string>("");

    const toast = useToast();
    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');

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
                nextPossibleTransferTime
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
                will.getNextPossibleTransferTime()
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
                nextPossibleTransferTime
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

    const calculateTimeUntilInactive = () => {
        if (!willInfo) return;

        const currentTime = Math.floor(Date.now() / 1000);
        const inactiveTime = Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod);
        const timeLeft = inactiveTime - currentTime;

        setTimeUntilInactive(timeLeft);

        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;

            if (hours > 0) {
                setCountdown(`${hours}h ${minutes}m ${seconds}s`);
            } else if (minutes > 0) {
                setCountdown(`${minutes}m ${seconds}s`);
            } else {
                setCountdown(`${seconds}s`);
            }
        } else {
            setCountdown("Inactive!");
        }
    };

    const confirmActivity = async () => {
        if (!willInfo) return;

        try {
            setConfirmLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);

            const tx = await will.confirmActivity();

            toast({
                title: "Transaction Sent",
                description: "Confirming activity...",
                status: "info",
                duration: 3000
            });

            await tx.wait();

            toast({
                title: "✅ Activity Confirmed!",
                description: "You have successfully confirmed that you are alive and healthy",
                status: "success",
                duration: 5000
            });

            // Update information
            loadWillInfo();

        } catch (error: any) {
            toast({
                title: "Confirmation Error",
                description: error.message,
                status: "error",
                duration: 5000
            });
        } finally {
            setConfirmLoading(false);
        }
    };

    useEffect(() => {
        loadWillInfo();
    }, [willAddress]);

    useEffect(() => {
        if (willInfo) {
            calculateTimeUntilInactive();
            const interval = setInterval(calculateTimeUntilInactive, 1000);
            return () => clearInterval(interval);
        }
    }, [willInfo]);

    if (loading) {
        return (
            <Box textAlign="center" py={10}>
                <Text>Loading will information...</Text>
            </Box>
        );
    }

    if (!willInfo) {
        return (
            <Alert status="error">
                <AlertIcon />
                <AlertTitle>Error!</AlertTitle>
                <AlertDescription>Failed to load will information</AlertDescription>
            </Alert>
        );
    }

    const progressValue = timeUntilInactive > 0
        ? (timeUntilInactive / Number(willInfo.willActivateWaitingPeriod)) * 100
        : 0;

    return (
        <VStack spacing={6} align="stretch">
            {/* Header */}
            <Card bg={cardBg}>
                <CardHeader>
                    <HStack>
                        <Icon as={FaShieldAlt} color="blue.500" boxSize={6} />
                        <VStack align="start" spacing={0}>
                            <Heading size="lg">My Will</Heading>
                            <Text color={textColor}>
                                Contract address: {willAddress.slice(0, 6)}...{willAddress.slice(-4)}
                            </Text>
                        </VStack>
                    </HStack>
                </CardHeader>
            </Card>

            {/* Activity status */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaUser} color="green.500" />
                                <Text fontWeight="semibold">Your Status</Text>
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

                        <Box width="100%">
                            <HStack justify="space-between" mb={2}>
                                <Text fontSize="sm" color={textColor}>Time until inactive:</Text>
                                <Text fontSize="sm" fontWeight="semibold" color={timeUntilInactive <= 0 ? "red.500" : "green.500"}>
                                    {countdown}
                                </Text>
                            </HStack>
                            <Progress
                                value={progressValue}
                                colorScheme={timeUntilInactive <= 0 ? "red" : "green"}
                                size="lg"
                                borderRadius="lg"
                            />
                        </Box>

                        <Text fontSize="sm" color={textColor} textAlign="center">
                            Last activity: {new Date(Number(willInfo.lastActivity) * 1000).toLocaleString()}
                        </Text>

                        {!willInfo.isOwnerActive && (
                            <Alert status="error" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>⚠️ You are inactive!</AlertTitle>
                                    <AlertDescription>
                                        The heir can receive payments. Confirm activity immediately!
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}

                        {willInfo.isOwnerActive && timeUntilInactive < 3600 && (
                            <Alert status="warning" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>⏰ You will soon become inactive!</AlertTitle>
                                    <AlertDescription>
                                        Confirm activity within {countdown}, otherwise the heir will be able to receive payments.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}
                    </VStack>
                </CardBody>
            </Card>

            {/* Heir information */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaHeart} color="red.500" />
                                <Text fontWeight="semibold">Heir</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color={textColor}>Name:</Text>
                                <Text fontWeight="semibold">{willInfo.heirName}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Role:</Text>
                                <Text fontWeight="semibold">{willInfo.heirRole}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Address:</Text>
                                <Text fontFamily="monospace" fontSize="sm">
                                    {willInfo.heir.slice(0, 6)}...{willInfo.heir.slice(-4)}
                                </Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Payment parameters */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaEthereum} color="green.500" />
                                <Text fontWeight="semibold">Payment Parameters</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color={textColor}>Payment amount:</Text>
                                <Text fontWeight="semibold">{ethers.formatEther(willInfo.transferAmount)} ETH</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Frequency:</Text>
                                <Text fontWeight="semibold">Every {Math.floor(Number(willInfo.transferFrequency) / 60)} minutes</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Waiting period:</Text>
                                <Text fontWeight="semibold">{Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} minutes</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Balance:</Text>
                                <Text fontWeight="semibold" color="green.500">{ethers.formatEther(willInfo.balance)} ETH</Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Activity confirmation button */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <Button
                            colorScheme="green"
                            size="xl"
                            width="100%"
                            py={6}
                            onClick={confirmActivity}
                            isLoading={confirmLoading}
                            leftIcon={<Icon as={FaCheck} />}
                            fontSize="lg"
                            fontWeight="bold"
                            borderRadius="xl"
                            loadingText="Confirming..."
                            _hover={{
                                transform: "translateY(-2px)",
                                boxShadow: "xl"
                            }}
                        >
                            💚 I'm alive and healthy!
                        </Button>

                        <Text textAlign="center" color={textColor} fontSize="sm">
                            Regularly confirm your activity so the heir cannot receive funds
                        </Text>

                        <Alert status="info" borderRadius="lg">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>ℹ️ How it works</AlertTitle>
                                <AlertDescription>
                                    When you press this button, the waiting period resets.
                                    The heir will only be able to receive payments if you don't confirm activity
                                    within {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} minutes.
                                </AlertDescription>
                            </Box>
                        </Alert>
                    </VStack>
                </CardBody>
            </Card>

            {/* Information about the next possible transfer */}
            {!willInfo.isOwnerActive && (
                <Card bg={cardBg} borderColor="red.500" borderWidth="2px">
                    <CardBody>
                        <VStack spacing={4}>
                            <HStack justify="space-between" width="100%">
                                <HStack>
                                    <Icon as={FaClock} color="red.500" />
                                    <Text fontWeight="semibold" color="red.500">ATTENTION!</Text>
                                </HStack>
                            </HStack>

                            <Alert status="error" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>The heir can receive payments!</AlertTitle>
                                    <AlertDescription>
                                        Next possible transfer: {new Date(Number(willInfo.nextPossibleTransferTime) * 1000).toLocaleString()}
                                        <br />
                                        Confirm activity to block transfers.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        </VStack>
                    </CardBody>
                </Card>
            )}

            {/* Update data */}
            <Box textAlign="center">
                <Button
                    variant="outline"
                    onClick={loadWillInfo}
                    isLoading={loading}
                    leftIcon={<Icon as={FaShieldAlt} />}
                >
                    Update data
                </Button>
            </Box>
        </VStack>
    );
}