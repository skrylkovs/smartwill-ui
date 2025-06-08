import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { ethers } from "ethers";
import {
    Box,
    Button,
    Text,
    VStack,
    Heading,
    Spinner,
    HStack,
    Flex,
    useToast,
    Divider,
    Center,
    Icon,
    useColorModeValue,
    Badge,
    Card,
    CardBody,
    CardHeader,
    SimpleGrid,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Alert,
    AlertIcon,
    AlertDescription
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaWallet, FaUser, FaEthereum, FaClock, FaHeartbeat, FaFileContract } from "react-icons/fa";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";
import DiagnosticInfo from "./DiagnosticInfo";

interface MyWillsProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

// Export type for use in other components
export interface WillInfo {
    address: string;
    balance: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: string;
    transferFrequency: string;
    waitingPeriod: string;
    limit: string;
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

    // Function to format time in seconds to readable format
    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds} sec.`;
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} min.`;
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (minutes === 0) return `${hours} h.`;
        return `${hours} h. ${minutes} min.`;
    };

    // Get will information
    const fetchWillInfo = async (willAddress: string, retryCount = 3, delayMs = 1000) => {
        try {
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            // Get main information from will contract
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
        } catch (error) {
            console.error(`Error getting will information ${willAddress}:`, error);

            // If we have retries left, wait and try again
            if (retryCount > 0) {
                console.log(`Retry attempt (${retryCount} left) for contract ${willAddress} after ${delayMs}ms...`);

                // Wait for specified time
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Recursively call function with decreased retry counter
                return fetchWillInfo(willAddress, retryCount - 1, delayMs * 1.5);
            }

            // Return basic information when retries are exhausted
            return {
                address: willAddress,
                balance: "Loading...",
                heir: "Loading...",
                heirName: "Loading...",
                heirRole: "Loading...",
                transferAmount: "Loading...",
                transferFrequency: "Loading...",
                waitingPeriod: "Loading...",
                limit: "Loading..."
            };
        }
    };

    // Get last ping from factory
    const fetchLastPing = async () => {
        try {
            if (!signer) return;

            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const signerAddress = await signer.getAddress();

            // Try to get last ping in different ways
            try {
                // First try calling getLastPing()
                try {
                    const lastPingTimestamp = await factory.getLastPing();

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Failed to get lastPing via getLastPing():", error);
                }

                // Then try to get via lastPings mapping
                try {
                    const lastPingTimestamp = await factory.lastPings(signerAddress);

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Failed to get lastPing via lastPings:", error);
                }

                // Try via getLastPingOf if implemented
                try {
                    const lastPingTimestamp = await factory.getLastPingOf(signerAddress);

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Failed to get lastPing via getLastPingOf:", error);
                }

                setLastPing("No last ping data");
            } catch (error) {
                console.error("All lastPing methods failed:", error);
                setLastPing("Error getting data");
            }
        } catch (error) {
            console.error("Error getting last ping information:", error);
            setLastPing("Error getting data");
        }
    };

    // Send ping to factory
    const handlePingAll = async () => {
        try {
            // First check the network
            const provider = signer.provider as ethers.BrowserProvider;
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            // Arbitrum Sepolia network ID: 421614
            if (chainId !== 421614) {
                throw new Error("Please switch to Arbitrum Sepolia network in your wallet");
            }

            setPingLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);

            console.log("📤 Sending ping...");

            // Send one ping to factory
            const pingTx = await factory.ping();
            console.log("⏳ Waiting for ping transaction confirmation...");

            // Wait for transaction confirmation
            await pingTx.wait();
            console.log("✅ Ping transaction confirmed:", pingTx.hash);

            // Add delay for blockchain state update
            console.log("⏳ Waiting for blockchain state update...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Update last ping information multiple times for reliability
            let pingUpdated = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`🔄 Attempt ${attempt} to update ping information...`);
                await fetchLastPing();

                // Check if time was updated (should be within last 5 minutes)
                const currentTime = new Date();
                const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);

                // If lastPing contains "No data" or "Error", try again
                if (!lastPing.includes("No data") && !lastPing.includes("Error")) {
                    try {
                        const lastPingDate = new Date(lastPing);
                        if (lastPingDate > fiveMinutesAgo) {
                            console.log("✅ Ping time successfully updated");
                            pingUpdated = true;
                            break;
                        }
                    } catch (dateError) {
                        console.log("⚠️ Date parsing error, trying again...");
                    }
                }

                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!pingUpdated) {
                console.log("⚠️ Ping time may not be fully updated, but operation completed");
            }

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
            const userAddress = await signer.getAddress();

            console.log("🔍 Wills loading diagnostics:");
            console.log("👤 User address:", userAddress);
            console.log("🏭 Factory address:", factoryAddress);

            // Get only current user's wills (safely)
            let willsList = [];
            try {
                // Use safe getMyWills() method
                willsList = await factory.getMyWills();
                console.log("✅ Found current user's wills:", willsList.length);
                console.log("📄 Will addresses:", willsList);
            } catch (error) {
                console.error("❌ Error calling getMyWills:", error);
                // If new method is unavailable, return empty array
                willsList = [];
            }

            // Additional diagnostics: check total number of wills
            try {
                const allWills = await factory.getDeployedWills();
                console.log("📊 Total wills in factory:", allWills.length);
                console.log("🔗 All will addresses:", allWills);

                // Check mapping for current user
                try {
                    const userWillsFromMapping = await factory.ownerToWills(userAddress, 0);
                    console.log("🗂️ First will from mapping:", userWillsFromMapping);
                } catch (mappingError) {
                    console.log("📝 Mapping empty for user (normal if no wills exist)");
                }
            } catch (debugError) {
                console.error("⚠️ Error getting debug information:", debugError);
            }

            // If wills list is empty, finish work
            if (willsList.length === 0) {
                console.log("❌ No wills found for current user");
                setWills([]);
                return;
            }

            // Add small delay before requesting will information,
            // to give blockchain time to process transactions
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Get information about each will
            const willsInfo = await Promise.all(
                willsList.map((address: string) => fetchWillInfo(address))
            );

            // Now display only current user's wills
            const validWills = willsInfo.filter(Boolean) as WillInfo[];
            console.log("✅ Valid user wills:", validWills.length);

            setWills(validWills);

            // Get last ping information
            await fetchLastPing();

            // Additional update after a second for reliability
            setTimeout(async () => {
                await fetchLastPing();
            }, 1000);
        } catch (error) {
            console.error("💥 General error loading wills:", error);
        } finally {
            setLoading(false);
        }
    };

    // Export methods via ref
    useImperativeHandle(ref, () => ({
        loadWills,
        refreshWills: () => {
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
        }
    }));

    // Loading hook on mount
    useEffect(() => {
        if (signer) {
            loadWills();
        }
    }, [signer]);

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

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Diagnostic information */}
            <DiagnosticInfo signer={signer} factoryAddress={factoryAddress} />

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
                                    <StatNumber color="#081781" fontSize={{ base: "6xl", xl: "3xl" }}>{wills.length}</StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Active contracts</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "2xl" }}>Total Balance</StatLabel>
                                    <StatNumber color="green.500" fontSize={{ base: "4xl", xl: "3xl" }}>
                                        {wills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0).toFixed(4)} ETH
                                    </StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "xl" }}>In all wills</StatHelpText>
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
                                                <Text fontSize={{ base: "xl", xl: "1xl" }} fontWeight="semibold" color={textColor}>
                                                    Heir Wallet
                                                </Text>
                                            </HStack>
                                            <Text fontSize={{ base: "xl", xl: "1xl" }} fontFamily="monospace" color="blue.500">
                                                {`${will.heir.slice(0, 6)}...${will.heir.slice(-4)}`}
                                            </Text>
                                        </VStack>

                                        {/* Financial information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaEthereum} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "2xl" }} fontWeight="semibold" color={textColor}>
                                                    Funds
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize={{ base: "xl", xl: "1xl" }}>
                                                    <strong>Transfer:</strong> {will.transferAmount} ETH
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "1xl" }}>
                                                    <strong>Balance:</strong> {will.balance} ETH
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Time information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaClock} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "2xl" }} fontWeight="semibold" color={textColor}>
                                                    Time Settings
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize={{ base: "xl", xl: "1xl" }}>
                                                    <strong>Transfer Frequency:</strong>{" "}
                                                    <Badge colorScheme="orange" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {formatTime(Number(will.transferFrequency))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "1xl" }}>
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
                        <CardBody>
                            <VStack spacing={6}>
                                <VStack spacing={2} textAlign="center">
                                    <HStack>
                                        <Icon as={FaHeartbeat} color="red.500" boxSize={6} />
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
                                    colorScheme="blue"
                                    size="lg"
                                    isLoading={pingLoading}
                                    loadingText="Sending confirmation..."
                                    width={{ base: "100%", md: "auto" }}
                                    px={12}
                                    py={6}
                                    fontSize={{ base: "2xl", xl: "lg" }}
                                    fontWeight="bold"
                                    leftIcon={<Icon as={FaHeartbeat} />}
                                    bgGradient="linear(to-r, #081781, #061264)"
                                    color="white"
                                    _hover={{
                                        bgGradient: "linear(to-r, #061264, #040d47)",
                                        transform: "translateY(-2px)",
                                        boxShadow: "xl"
                                    }}
                                    _active={{ transform: "translateY(0)" }}
                                    transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                                    borderRadius="xl"
                                >
                                    Confirm Life Activity
                                </Button>

                                <Alert status="info" borderRadius="lg" variant="subtle">
                                    <AlertIcon />
                                    <AlertDescription fontSize={{ base: "xl", xl: "sm" }}>
                                        Last confirmation: <strong>{lastPing}</strong>
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