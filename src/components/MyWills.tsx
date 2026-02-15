import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { ethers } from "ethers";
import { getGasOverrides } from "../utils/gas";
import {
    Box, Button, Text, VStack, Heading, Spinner, HStack, Flex, useToast, Divider, Center,
    Icon, useColorModeValue, Badge, Card, CardBody, CardHeader, SimpleGrid, Stat, StatLabel,
    StatNumber, StatHelpText, Alert, AlertIcon, AlertDescription
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaWallet, FaUser, FaEthereum, FaClock, FaHeartbeat, FaFileContract } from "react-icons/fa";
import pRetry from "p-retry";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";
import type { WillInfo } from "../types";
import { formatTime } from "../utils/format";

interface MyWillsProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

// Change to forwardRef and export methods via useImperativeHandle
const MyWills = forwardRef(({ signer, factoryAddress }: MyWillsProps, ref) => {
    const [wills, setWills] = useState<WillInfo[]>([]);
    const [lastPing, setLastPing] = useState<string>("Loading...");
    const [loading, setLoading] = useState(false);
    const [pingLoading, setPingLoading] = useState(false);
    const toast = useToast();

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    // Get will information
    const fetchWillInfo = async (willAddress: string): Promise<WillInfo> => {
        return await pRetry(async () => {
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            const [balance, heir, heirName, heirRole, transferAmount, transferFrequency, waitingPeriod, limit] = await Promise.all([
                contract.getBalance(),
                contract.heir(),
                contract.heirName(),
                contract.heirRole(),
                contract.transferAmount(),
                contract.transferFrequency(),
                contract.willActivateWaitingPeriod(),
                contract.limit()
            ]);

            return {
                address: willAddress,
                balance: ethers.formatEther(balance),
                heir,
                heirName,
                heirRole,
                transferAmount: ethers.formatEther(transferAmount),
                transferFrequency: transferFrequency.toString(),
                waitingPeriod: waitingPeriod.toString(),
                limit: ethers.formatEther(limit)
            };
        }, {
            retries: 3,
            minTimeout: 1000,
            factor: 1.5,
            onFailedAttempt: ({ attemptNumber, retriesLeft, error }) => {
                console.warn(`Retry ${attemptNumber}/${attemptNumber + retriesLeft} for contract ${willAddress}: ${error.message}`);
            }
        });
    };

    // Get last ping from factory
    const fetchLastPing = async () => {
        try {
            if (!signer) return;

            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const lastPingTimestamp = await factory.getLastPing();

            if (lastPingTimestamp > 0) {
                setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                return;
            }
        } catch (error) {
            console.error("Error getting last ping information:", error);
        }
    };

    // Send ping to factory
    const handlePingAll = async () => {
        try {
            setPingLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);

            // Get gas overrides to avoid "maxFeePerGas less than block base fee" error
            const gasOverrides = await getGasOverrides(signer);

            // Send one ping to factory with explicit gas fee
            const pingTx = await factory.ping(gasOverrides);

            // Wait for transaction confirmation
            await pingTx.wait();

            // Add delay for blockchain state update
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Update last ping information
            console.log("⏳ Update last ping information...");
            await fetchLastPing();

            toast({
                title: "Success!",
                description: `You confirmed that you are alive. Time updated.`,
                status: "success",
                duration: 5000,
                isClosable: true,
            });

        } catch (error) {
            console.error("Error sending ping:", error);
            toast({
                title: "Error",
                description: "Failed to confirm that you are alive. Check console for details.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setPingLoading(false);
        }
    };

    // Method to load wills
    const loadWills = async () => {
        try {
            setLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);

            // Get will addresses from factory
            const willsList: string[] = await factory.getMyWills();

            // Get information about each will
            const wills = await Promise.all(willsList.map(address => fetchWillInfo(address)));
            setWills(wills);

            // Get last ping information
            await fetchLastPing();

        } catch (error) {
            console.error("💥 General error loading wills:", error);
            toast({
                title: "Loading Error",
                description: "Failed to load wills data. Check console for details.",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
        }
    };

    // Method to force data refresh
    const refreshWills = () => {
        if (signer) {
            loadWills();
            toast({
                title: "Data Update",
                description: "Loading latest will data...",
                status: "info",
                duration: 2000,
                isClosable: true
            });
        }
    };

    // Export methods via ref
    useImperativeHandle(ref, () => ({
        loadWills,
        refreshWills
    }));

    // Loading hook on mount
    useEffect(() => {
        if (signer && factoryAddress) {
            loadWills();
        }
    }, [signer, factoryAddress]);

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Header with refresh button */}
            <Flex justifyContent="space-between" alignItems="center">
                <HStack spacing={3}>
                    <Icon as={FaFileContract} boxSize={6} color="#081781" />
                    <Heading size={{ base: "xl", xl: "lg" }} bgGradient="linear(to-r, #081781, #061264)" bgClip="text">
                        My Wills
                    </Heading>
                </HStack>
                <Button
                    size="md"
                    onClick={refreshWills}
                    leftIcon={<Icon as={RepeatIcon} />}
                    isLoading={loading}
                    colorScheme="purple"
                    variant="outline"
                    borderRadius="lg"
                    borderColor="#081781"
                    color="#081781"
                    _hover={{
                        bg: "transparent",
                        transform: "translateY(-1px)",
                        bgGradient: "linear(to-r, #081781, #061264)",
                        color: "white",
                        borderColor: "transparent"
                    }}
                    transition="all 0.2s"
                    fontSize={{ base: "2xl", xl: "md" }}
                >
                    Refresh
                </Button>
            </Flex>

            {loading ? (
                <Center p={16}>
                    <VStack spacing={6}>
                        <Spinner size="xl" color="#081781" thickness="4px" speed="0.8s" />
                        <Text fontSize={{ base: "2xl", xl: "lg" }} color={textColor} fontWeight="medium">
                            Loading wills...
                        </Text>
                    </VStack>
                </Center>
            ) : wills.length === 0 ? (
                <Box py={16} textAlign="center">
                    <VStack spacing={6}>
                        <Icon as={FaFileContract} boxSize={16} color="gray.300" />
                        <VStack spacing={2}>
                            <Heading size={{ base: "2xl", xl: "md" }} color={textColor}>
                                You don't have any wills yet
                            </Heading>
                            <Text fontSize={{ base: "2xl", xl: "lg" }} color={textColor}>
                                Create a new will to start managing your assets
                            </Text>
                        </VStack>
                    </VStack>
                </Box>
            ) : (
                <>
                    {/* Statistics */}
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Total Wills</StatLabel>
                                    <StatNumber color="#081781" fontSize={{ base: "4xl", xl: "3xl" }}>{wills.length}</StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Active contracts</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Total Balance</StatLabel>
                                    <StatNumber color="green.500" fontSize={{ base: "4xl", xl: "3xl" }}>
                                        {wills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0).toFixed(4)} ETH
                                    </StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>In all wills</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Last Activity</StatLabel>
                                    <StatNumber fontSize={{ base: "4xl", xl: "3xl" }} color="blue.500">
                                        {lastPing}
                                    </StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Life Confirmation</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                    </SimpleGrid>

                    {/* List of wills */}
                    <VStack spacing={6} align="stretch">
                        {wills.map((will, index) => (
                            <Card
                                key={will.address}
                                bg={cardBg}
                                borderRadius="xl"
                                boxShadow="lg"
                                border="1px solid"
                                borderColor={borderColor}
                                _hover={{
                                    transform: "translateY(-2px)",
                                    boxShadow: "xl",
                                    borderColor: "#081781"
                                }}
                                transition="all 0.2s"
                            >
                                <CardHeader pb={2}>
                                    <HStack justify="space-between">
                                        <HStack spacing={3}>
                                            <Icon as={FaUser} color="blue.500" boxSize={5} />
                                            <VStack align="start" spacing={0}>
                                                <Heading fontSize={{ base: "3xl", xl: "2xl" }} color="#081781">
                                                    {will.heirName}
                                                </Heading>
                                                <Badge colorScheme="blue" variant="subtle" borderRadius="md" fontSize={{ base: "xl", xl: "sm" }}>
                                                    {will.heirRole}
                                                </Badge>
                                            </VStack>
                                        </HStack>
                                        <Badge colorScheme="green" variant="outline" fontSize={{ base: "xl", xl: "sm" }} px={3} py={1}>
                                            Will #{index + 1}
                                        </Badge>
                                    </HStack>
                                </CardHeader>

                                <CardBody pt={2}>
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                                        {/* Heir information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaWallet} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "sm" }} fontWeight="semibold" color={textColor}>
                                                    Heir Wallet
                                                </Text>
                                            </HStack>
                                            <Text fontSize={{ base: "xl", xl: "sm" }} fontFamily="monospace" color="blue.500">
                                                {`${will.heir.slice(0, 6)}...${will.heir.slice(-4)}`}
                                            </Text>
                                        </VStack>

                                        {/* Financial information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaEthereum} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "sm" }} fontWeight="semibold" color={textColor}>
                                                    Funds
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={3}>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Transfer:</strong> {will.transferAmount} ETH
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Balance:</strong> {will.balance} ETH
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Time information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaClock} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "sm" }} fontWeight="semibold" color={textColor}>
                                                    Time Settings
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={3}>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Transfer Frequency:</strong>{" "}
                                                    <Badge colorScheme="orange" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {formatTime(Number(will.transferFrequency))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Waiting Period:</strong>{" "}
                                                    <Badge colorScheme="purple" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {formatTime(Number(will.waitingPeriod))}
                                                    </Badge>
                                                </Text>
                                            </VStack>
                                        </VStack>
                                    </SimpleGrid>

                                    <Divider my={4} />

                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg">
                                        <Text fontSize={{ base: "lg", xl: "xs" }} color={textColor} fontFamily="monospace">
                                            <strong>Contract Address:</strong> {will.address}
                                        </Text>
                                    </Box>
                                </CardBody>
                            </Card>
                        ))}
                    </VStack>

                    {/* Life confirmation section */}
                    <Card
                        bg={cardBg}
                        borderRadius="xl"
                        boxShadow="lg"
                    >
                        <CardBody p={{ base: 4, md: 6 }}>
                            <VStack spacing={{ base: 4, md: 6 }}>
                                <VStack spacing={2} textAlign="center">
                                    <HStack>
                                        <Icon as={FaHeartbeat} color="red.500" boxSize={{ base: 4, md: 6 }} />
                                        <Heading size={{ base: "2xl", xl: "md" }} color="#081781">
                                            Life Confirmation
                                        </Heading>
                                    </HStack>
                                    <Text color={textColor} fontSize={{ base: "2xl", xl: "sm" }} maxW="500px">
                                        Regularly confirm your activity to keep your wills under your control
                                    </Text>
                                </VStack>

                                <Button
                                    onClick={handlePingAll}
                                    isLoading={pingLoading}
                                    loadingText="Sending..."
                                    colorScheme="red"
                                    size="lg"
                                    leftIcon={<Icon as={FaHeartbeat} />}
                                    _hover={{
                                        transform: "translateY(-1px)",
                                        boxShadow: "lg"
                                    }}
                                    fontSize={{ base: "2xl", xl: "md" }}
                                >
                                    Confirm I'm Alive
                                </Button>

                                <Alert
                                    status="info"
                                    borderRadius="lg"
                                    variant="subtle"
                                    p={{ base: 3, md: 4 }}
                                >
                                    <AlertIcon boxSize={{ base: 4, md: 5 }} />
                                    <AlertDescription fontSize={{ base: "xl", xl: "sm" }}>
                                        Last confirmation: {lastPing}
                                    </AlertDescription>
                                </Alert>
                            </VStack>
                        </CardBody>
                    </Card>
                </>
            )}
        </VStack>
    );
});

export default MyWills;