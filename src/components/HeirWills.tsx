import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import { getGasOverrides } from "../utils/gas";
import {
    Box, Button, Text, VStack, Heading, Spinner, HStack, Flex, useToast, Divider, Center,
    Icon, useColorModeValue, Badge, Card, CardBody, CardHeader, SimpleGrid, Stat, StatLabel,
    StatNumber, StatHelpText, Alert, AlertIcon, AlertDescription
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaUser, FaEthereum, FaClock, FaGift, FaCoins } from "react-icons/fa";
import pRetry, { AbortError } from "p-retry";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";
import type { HeirWillInfo } from "../types";
import { formatTime } from "../utils/format";

interface HeirWillsProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

const HeirWills = forwardRef(({ signer, factoryAddress }: HeirWillsProps, ref) => {
    const [heirWills, setHeirWills] = useState<HeirWillInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
    const [claimingWill, setClaimingWill] = useState<string | null>(null);
    const toast = useToast();

    // Add refs to prevent duplicate calls
    const loadingRef = useRef(false);
    const cacheRef = useRef<Map<string, HeirWillInfo>>(new Map());
    const lastLoadRef = useRef<number>(0);
    const requestCountRef = useRef<number>(0);

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.800', 'white');

    // Add request counter for debugging
    useEffect(() => {
        requestCountRef.current = 0;
        console.log("🚀 HeirWills component initialized");

        return () => {
            console.log(`🏁 HeirWills component unmounted. Total requests: ${requestCountRef.current}`);
        };
    }, []);

    const formatNextClaimTime = (nextTransferTime: string, ownerLastActivity: string, waitingPeriod: string): string => {
        const nextTime = parseInt(nextTransferTime);
        const lastActivity = parseInt(ownerLastActivity);
        const waitingSeconds = parseInt(waitingPeriod);
        const now = Math.floor(Date.now() / 1000);

        // If nextTransferTime is in the future, that's the earliest possible claim
        if (nextTime > now) {
            return `In ${formatTime(nextTime - now)}`;
        }

        // Otherwise (0 or past), check waiting period after owner's last activity
        const waitingEndsAt = lastActivity + waitingSeconds;
        if (now >= waitingEndsAt) {
            return "Available now";
        }

        return `In ${formatTime(waitingEndsAt - now)} (waiting period after activity)`;
    };

    // Get will information for heir with caching and retry
    const fetchHeirWillInfo = useCallback(async (willAddress: string, userAddress: string): Promise<HeirWillInfo | null> => {
        requestCountRef.current += 1;

        // Check cache
        const cacheKey = `${willAddress}-${userAddress}`;
        const cached = cacheRef.current.get(cacheKey);
        if (cached) {
            console.log(`📋 Using cache for will ${willAddress}... (request #${requestCountRef.current})`);
            return cached;
        }

        try {
            const willInfo = await pRetry(async () => {
                console.log(`📋 Analyzing will for heir ${willAddress}... (request #${requestCountRef.current})`);
                const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

                const heir = await contract.heir();

                // Not heir — abort retries immediately (not a transient error)
                if (heir.toLowerCase() !== userAddress.toLowerCase()) {
                    throw new AbortError(`User is not heir of will ${willAddress}`);
                }

                const [ balance, transferAmount, heirName, heirRole, transferFrequency, waitingPeriod,
                        ownerLastActivity, limit, ownerAddress, canTransferNow, nextTransferTime
                ] = await Promise.all([
                    contract.getBalance(),
                    contract.transferAmount(),
                    contract.heirName(),
                    contract.heirRole(),
                    contract.transferFrequency(),
                    contract.willActivateWaitingPeriod(),
                    contract.getOwnerLastActivity(),
                    contract.limit(),
                    contract.owner(),
                    contract.canTransferNow(),
                    contract.getNextTransferTime().catch(() => contract.getNextPossibleTransferTime())
                ]);

                const canClaim = balance >= transferAmount && canTransferNow;
                console.log(`✅ Will ${willAddress}: heir=${heir}, canTransfer=${canTransferNow}, canClaim=${canClaim}`);

                return {
                    address: willAddress,
                    balance: ethers.formatEther(balance),
                    ownerAddress,
                    heirName,
                    heirRole,
                    transferAmount: ethers.formatEther(transferAmount),
                    transferFrequency: transferFrequency.toString(),
                    waitingPeriod: waitingPeriod.toString(),
                    ownerLastActivity: ownerLastActivity.toString(),
                    limit: ethers.formatEther(limit as bigint),
                    canClaim,
                    nextClaimTime: nextTransferTime.toString()
                } as HeirWillInfo;
            }, {
                retries: 3,
                minTimeout: 1000,
                factor: 1.5,
                onFailedAttempt: ({ attemptNumber, retriesLeft, error }) => {
                    console.warn(`fetchHeirWillInfo retry ${attemptNumber}/${attemptNumber + retriesLeft} for ${willAddress}: ${error.message}`);
                }
            });

            // Cache result for 30 seconds
            cacheRef.current.set(cacheKey, willInfo);
            setTimeout(() => { cacheRef.current.delete(cacheKey); }, 30000);
            return willInfo;
        } catch (error) {
            if (error instanceof AbortError) {
                console.log(`❌ ${(error as Error).message}`);
            } else {
                console.error(`❌ Error analyzing will ${willAddress} after all retries:`, error);
            }
            return null;
        }
    }, [signer]);

    // Load wills where user is heir with protection from duplicate calls
    const loadHeirWills = useCallback(async () => {
        // Prevent duplicate calls
        if (loadingRef.current) {
            console.log("⏳ Loading already in progress, skipping...");
            return;
        }

        // Debouncing - don't load more often than once every 2 seconds
        const now = Date.now();
        if (now - lastLoadRef.current < 2000) {
            console.log(`⏰ Too frequent calls (${now - lastLoadRef.current}ms ago), skipping...`);
            return;
        }

        try {
            console.log("🚀 Starting heir wills loading...");
            loadingRef.current = true;
            lastLoadRef.current = now;
            setLoading(true);
            setLoadingProgress({current: 0, total: 0});

            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const userAddress = await signer.getAddress();

            // Get all deployed wills
            let willsList = [];
            try {
                willsList = await factory.getDeployedWills();
            } catch (error) {
                console.log("Error calling getDeployedWills, trying alternative method:", error);

                let index = 0;
                let continueLoop = true;

                while (continueLoop) {
                    try {
                        const willAddress = await factory.deployedWills(index);
                        willsList.push(willAddress);
                        index++;
                    } catch (error) {
                        console.log(`Reached end of wills list at index ${index}`);
                        continueLoop = false;
                    }
                }
            }

            console.log("Checking wills for heir:", willsList.length);
            setLoadingProgress({current: 0, total: willsList.length});

            if (willsList.length === 0) {
                setHeirWills([]);
                return;
            }

            // Sequentially check each will to avoid RPC overload
            const validHeirWills: HeirWillInfo[] = [];

            for (let i = 0; i < willsList.length; i++) {
                const address = willsList[i];
                setLoadingProgress({current: i + 1, total: willsList.length});

                try {
                    const willInfo = await fetchHeirWillInfo(address, userAddress);
                    if (willInfo) {
                        validHeirWills.push(willInfo);
                    }
                } catch (error) {
                    console.warn(`Skipping will ${address} due to error:`, error);
                    continue;
                }

                // Small pause between requests to avoid RPC overload
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`✅ Found ${validHeirWills.length} wills for heir`);
            setHeirWills(validHeirWills);

        } catch (error) {
            console.error("❌ Error loading heir wills:", error);
            toast({
                title: "Loading Error",
                description: "Failed to load inheritance data",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [signer, factoryAddress, fetchHeirWillInfo, toast]);

    // Method to claim inheritance from will
    const claimInheritance = async (willAddress: string) => {
        try {
            setClaimingWill(willAddress);
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            // Get gas overrides to avoid "maxFeePerGas less than block base fee" error
            const gasOverrides = await getGasOverrides(signer);

            // Call function to claim funds
            const tx = await contract.transferToHeir(gasOverrides);

            toast({
                title: "Transaction Sent",
                description: "Waiting for confirmation...",
                status: "info",
                duration: 3000,
                isClosable: true
            });

            // Wait for transaction confirmation
            await tx.wait();

            toast({
                title: "Success!",
                description: "Funds transferred to your wallet",
                status: "success",
                duration: 5000,
                isClosable: true
            });

            // Update wills information
            loadHeirWills();

        } catch (error) {
            console.error("Error claiming inheritance:", error);
            toast({
                title: "Error",
                description: "Failed to claim funds. Check will conditions.",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setClaimingWill(null);
        }
    };

    // Add imperativeHandle for external control
    useImperativeHandle(ref, () => ({
        refreshWills: () => {
            // Clear cache on forced refresh
            cacheRef.current.clear();
            if (signer) {
                loadHeirWills();
                toast({
                    title: "Data Update",
                    description: "Loading inheritance data...",
                    status: "info",
                    duration: 2000,
                    isClosable: true
                });
            }
        }
    }));

    // Load on component mount with optimization
    useEffect(() => {
        if (signer && factoryAddress) {
            loadHeirWills();
        }
    }, [loadHeirWills]); // Change dependency to memoized function

    // Method to force data refresh
    const refreshWills = useCallback(() => {
        // Clear cache on forced refresh
        cacheRef.current.clear();
        if (signer) {
            loadHeirWills();
            toast({
                title: "Data Update",
                description: "Loading inheritance data...",
                status: "info",
                duration: 2000,
                isClosable: true
            });
        }
    }, [signer, loadHeirWills, toast]);

    // Memoized statistical data
    const statistics = useMemo(() => {
        const totalBalance = heirWills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0);
        const claimableWills = heirWills.filter(will => will.canClaim).length;

        return {
            totalWills: heirWills.length,
            totalBalance: totalBalance.toFixed(4),
            claimableWills
        };
    }, [heirWills]);

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Heading with refresh button */}
            <Flex justifyContent="space-between" alignItems="center">
                <HStack spacing={3}>
                    <Icon as={FaGift} boxSize={6} color="green.500" />
                    <Heading size={{ base: "xl", xl: "lg" }} bgGradient="linear(to-r, green.500, green.600)" bgClip="text">
                        My inheritance
                    </Heading>
                </HStack>
                <Button
                    size="md"
                    onClick={refreshWills}
                    leftIcon={<Icon as={RepeatIcon} />}
                    colorScheme="green"
                    variant="outline"
                    _hover={{
                        bg: "green.50",
                        transform: "translateY(-1px)"
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
                        <Spinner size="xl" color="green.500" thickness="4px" speed="0.8s" />
                        <VStack spacing={2}>
                            <Text fontSize={{ base: "2xl", xl: "lg" }} color={textColor} fontWeight="medium">
                                Searching for wills...
                            </Text>
                            {loadingProgress.total > 0 && (
                                <Text fontSize={{ base: "2xl", xl: "sm" }} color="gray.500">
                                    Checked {loadingProgress.current} of {loadingProgress.total} wills
                                </Text>
                            )}
                            <Text fontSize={{ base: "xl", xl: "xs" }} color="gray.400">
                                Requests completed: {requestCountRef.current}
                            </Text>
                        </VStack>
                    </VStack>
                </Center>
            ) : heirWills.length === 0 ? (
                <Box py={16} textAlign="center">
                    <VStack spacing={6}>
                        <Icon as={FaGift} boxSize={16} color="gray.300" />
                        <VStack spacing={2}>
                            <Heading size={{ base: "2xl", xl: "md" }} color={textColor}>
                                You are not an heir
                            </Heading>
                            <Text fontSize={{ base: "2xl", xl: "lg" }} color={textColor}>
                                At the moment, there are no available wills for you
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
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Wills</StatLabel>
                                    <StatNumber color="green.500" fontSize={{ base: "4xl", xl: "3xl" }}>{statistics.totalWills}</StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Where you are an heir</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Available to receive</StatLabel>
                                    <StatNumber color="blue.500" fontSize={{ base: "4xl", xl: "3xl" }}>
                                        {statistics.totalBalance} ETH
                                    </StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Total amount</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor} fontSize={{ base: "2xl", xl: "md" }}>Ready to receive</StatLabel>
                                    <StatNumber color="orange.500" fontSize={{ base: "4xl", xl: "3xl" }}>
                                        {statistics.claimableWills}
                                    </StatNumber>
                                    <StatHelpText fontSize={{ base: "xl", xl: "sm" }}>Wills</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                    </SimpleGrid>

                    {/* Wills list */}
                    <VStack spacing={6} align="stretch">
                        {heirWills.map((will, index) => (
                            <Card
                                key={will.address}
                                bg={cardBg}
                                borderRadius="xl"
                                boxShadow="lg"
                                border="2px solid"
                                borderColor={will.canClaim ? "green.200" : "gray.200"}
                                _hover={{
                                    transform: "translateY(-2px)",
                                    boxShadow: "xl",
                                    borderColor: will.canClaim ? "green.300" : "gray.300"
                                }}
                                transition="all 0.2s"
                            >
                                <CardHeader pb={2}>
                                    <HStack justify="space-between">
                                        <HStack spacing={3}>
                                            <Icon as={FaUser} color="blue.500" boxSize={5} />
                                            <VStack align="start" spacing={0}>
                                                <Heading fontSize={{ base: "3xl", xl: "2xl" }} color="#081781">
                                                    {will.heirName} ({will.heirRole})
                                                </Heading>
                                                <Text fontSize={{ base: "xl", xl: "sm" }} color={textColor}>
                                                    From: {`${will.ownerAddress.slice(0, 6)}...${will.ownerAddress.slice(-4)}`}
                                                </Text>
                                            </VStack>
                                        </HStack>
                                        <VStack align="end" spacing={1}>
                                            <Badge
                                                colorScheme={will.canClaim ? "green" : "orange"}
                                                variant="outline"
                                                fontSize={{ base: "xl", xl: "sm" }}
                                                px={3}
                                                py={1}
                                            >
                                                Will #{index + 1}
                                            </Badge>
                                            {will.canClaim && (
                                                <Badge colorScheme="green" variant="solid" fontSize={{ base: "lg", xl: "xs" }}>
                                                    Ready to receive
                                                </Badge>
                                            )}
                                        </VStack>
                                    </HStack>
                                </CardHeader>

                                <CardBody pt={2}>
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
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
                                                    <strong>Available:</strong> {will.balance} ETH
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Per transfer:</strong> {will.transferAmount} ETH
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Time information */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaClock} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "sm" }} fontWeight="semibold" color={textColor}>
                                                    Time settings
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={3}>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Transfer frequency:</strong>{" "}
                                                    <Badge colorScheme="orange" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {formatTime(Number(will.transferFrequency))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Waiting period:</strong>{" "}
                                                    <Badge colorScheme="purple" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {formatTime(Number(will.waitingPeriod))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize={{ base: "xl", xl: "sm" }}>
                                                    <strong>Last activity:</strong>{" "}
                                                    <Badge colorScheme="blue" variant="subtle" borderRadius="md" fontSize={{ base: "lg", xl: "xs" }}>
                                                        {new Date(Number(will.ownerLastActivity) * 1000).toLocaleString()}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize={{ base: "lg", xl: "xs" }} color={textColor}>
                                                    Next opportunity: {formatNextClaimTime(will.nextClaimTime, will.ownerLastActivity, will.waitingPeriod)}
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Actions */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaCoins} color="gray.500" />
                                                <Text fontSize={{ base: "2xl", xl: "sm" }} fontWeight="semibold" color={textColor}>
                                                    Actions
                                                </Text>
                                            </HStack>
                                            <Button
                                                onClick={() => claimInheritance(will.address)}
                                                isDisabled={!will.canClaim}
                                                isLoading={claimingWill === will.address}
                                                loadingText="Receiving..."
                                                colorScheme="green"
                                                size="sm"
                                                leftIcon={<Icon as={FaGift} />}
                                                _hover={{
                                                    transform: will.canClaim ? "translateY(-1px)" : "none",
                                                    boxShadow: will.canClaim ? "md" : "none"
                                                }}
                                                fontSize={{ base: "xl", xl: "sm" }}
                                            >
                                                Receive funds
                                            </Button>
                                        </VStack>
                                    </SimpleGrid>

                                    <Divider my={4} />

                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg">
                                        <Text fontSize={{ base: "lg", xl: "xs" }} color={textColor} fontFamily="monospace">
                                            <strong>Contract address:</strong> {will.address}
                                        </Text>
                                    </Box>
                                </CardBody>
                            </Card>
                        ))}
                    </VStack>

                    {/* Information message */}
                    <Alert status="info" borderRadius="xl" variant="subtle">
                        <AlertIcon />
                        <AlertDescription fontSize={{ base: "xl", xl: "sm" }}>
                            You can receive funds only if the will owner did not show activity during the established period of time.
                        </AlertDescription>
                    </Alert>
                </>
            )}
        </VStack>
    );
});

export default HeirWills;