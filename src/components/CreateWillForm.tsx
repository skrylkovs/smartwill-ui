import { useState, useEffect } from "react";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    useToast,
    Text,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Grid,
    Heading,
    useColorModeValue,
    Icon,
    HStack,
    Divider,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Badge
} from "@chakra-ui/react";
import { FaUser, FaEthereum, FaClock, FaShieldAlt } from "react-icons/fa";
import { ethers } from "ethers";
import factoryAbi from "../contracts/SmartWillFactory.json";

interface Props {
    signer: ethers.Signer;
    onWillCreated: (address: string) => void;
    factoryAddress: string;
}

export default function CreateWillForm({ signer, onWillCreated, factoryAddress }: Props) {
    const [form, setForm] = useState({
        heir: "",
        heirName: "",
        heirRole: "",
        transferAmount: "",
        frequency: 180,
        waitingPeriod: 300,
        limit: ""
    });
    const [loading, setLoading] = useState(false);
    const [networkError, setNetworkError] = useState<string | null>(null);

    const toast = useToast();

    // Check network on component load
    useEffect(() => {
        const checkNetwork = async () => {
            try {
                if (!signer) return;

                // Get network information
                const provider = signer.provider as ethers.BrowserProvider;
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);

                // Arbitrum Sepolia network ID: 421614
                if (chainId !== 421614) {
                    setNetworkError("Please switch to Arbitrum Sepolia network in your wallet");
                } else {
                    setNetworkError(null);
                }
            } catch (err) {
                console.error("Error checking network:", err);
            }
        };

        checkNetwork();
    }, [signer]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        try {
            // First check the network
            const provider = signer.provider as ethers.BrowserProvider;
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            // Arbitrum Sepolia network ID: 421614
            if (chainId !== 421614) {
                throw new Error("Please switch to Arbitrum Sepolia network in your wallet");
            }

            setLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);

            const minFrequency = 60;
            const minWaitingPeriod = 120;

            const frequency = Math.max(Number(form.frequency), minFrequency);
            const waitingPeriod = Math.max(Number(form.waitingPeriod), minWaitingPeriod);

            const transferAmountWei = ethers.parseEther(form.transferAmount);
            const limitWei = ethers.parseEther(form.limit);

            if (limitWei < transferAmountWei) {
                throw new Error("Limit must be greater than or equal to transfer amount");
            }

            // Add gas limit to solve estimateGas problem
            const gasLimit = ethers.toBigInt(1200000); // Increased gas limit for new security methods

            // Log parameters for debugging
            console.log("🔧 Parameters for createSmartWill:");
            console.log("- heir:", form.heir);
            console.log("- heirName:", form.heirName);
            console.log("- heirRole:", form.heirRole);
            console.log("- transferAmount:", ethers.formatEther(transferAmountWei), "ETH");
            console.log("- frequency:", frequency, "seconds");
            console.log("- waitingPeriod:", waitingPeriod, "seconds");
            console.log("- limit:", ethers.formatEther(limitWei), "ETH");
            console.log("- value:", ethers.formatEther(limitWei), "ETH");
            console.log("- gasLimit:", gasLimit.toString());

            const tx = await factory.createSmartWill(
                form.heir,
                form.heirName,
                form.heirRole,
                ethers.parseEther(form.transferAmount),
                frequency,
                waitingPeriod,
                limitWei,
                {
                    value: limitWei,
                    gasLimit: gasLimit
                }
            );

            toast({
                title: "Transaction sent",
                description: "Waiting for confirmation...",
                status: "info",
                duration: 5000
            });

            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment?.name === "WillCreated");
            const newAddress = event?.args?.willAddress;

            if (newAddress) {
                toast({
                    title: "Will created",
                    description: `New will at address: ${newAddress}`,
                    status: "success",
                    duration: 5000
                });

                setForm({
                    heir: "",
                    heirName: "",
                    heirRole: "",
                    transferAmount: "",
                    frequency: 180,
                    waitingPeriod: 300,
                    limit: ""
                });

                onWillCreated(newAddress);
            }
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                status: "error",
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const inputBg = useColorModeValue('gray.50', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    return (
        <VStack spacing={8} align="stretch">
            {networkError && (
                <Alert
                    status="error"
                    borderRadius="xl"
                    variant="modern"
                    bg={cardBg}
                >
                    <AlertIcon />
                    <Box>
                        <AlertTitle>Network Error!</AlertTitle>
                        <AlertDescription>{networkError}</AlertDescription>
                    </Box>
                </Alert>
            )}

            {/* Header */}
            <Box textAlign="center">
                <HStack justify="center" mb={4}>
                    <Icon as={FaShieldAlt} boxSize={8} color="#081781" />
                    <Heading size="lg" bgGradient="linear(to-r, #081781, #061264)" bgClip="text">
                        Create Will
                    </Heading>
                </HStack>
                <Text color={textColor} fontSize="lg" maxW="600px" mx="auto">
                    Create a smart will for secure transfer of your crypto assets
                </Text>
            </Box>

            <Divider />

            {/* Heir Information */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaUser} color="blue.500" />
                    <Heading size="md">Heir Information</Heading>
                </HStack>

                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Heir Full Name
                        </FormLabel>
                        <Input
                            name="heirName"
                            value={form.heirName}
                            onChange={handleChange}
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{
                                borderColor: "#081781",
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="John Smith"
                            size="lg"
                        />
                    </FormControl>

                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Relationship
                        </FormLabel>
                        <Input
                            name="heirRole"
                            value={form.heirRole}
                            onChange={handleChange}
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{
                                borderColor: "#081781",
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="Son, Daughter, Spouse"
                            size="lg"
                        />
                    </FormControl>

                    <FormControl gridColumn={{ md: "span 2" }}>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Heir Wallet Address
                        </FormLabel>
                        <Input
                            name="heir"
                            value={form.heir}
                            onChange={handleChange}
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{
                                borderColor: "#081781",
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0x742d35Cc6634C0532925a3b8D4C9db96590c6C87"
                            fontFamily="monospace"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Ethereum address of the wallet where funds will be transferred
                        </Text>
                    </FormControl>
                </Grid>
            </Box>

            <Divider />

            {/* Financial Parameters */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaEthereum} color="green.500" />
                    <Heading size="md">Financial Parameters</Heading>
                </HStack>

                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Regular Transfer Amount (ETH)
                        </FormLabel>
                        <Input
                            name="transferAmount"
                            value={form.transferAmount}
                            onChange={handleChange}
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{
                                borderColor: "#081781",
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0.001"
                            type="number"
                            step="0.001"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Amount that will be transferred to heir regularly
                        </Text>
                    </FormControl>

                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Total Limit (ETH)
                        </FormLabel>
                        <Input
                            name="limit"
                            value={form.limit}
                            onChange={handleChange}
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{
                                borderColor: "#081781",
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0.005"
                            type="number"
                            step="0.001"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Maximum amount that can be transferred
                        </Text>
                    </FormControl>
                </Grid>
            </Box>

            <Divider />

            {/* Time Parameters */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaClock} color="orange.500" />
                    <Heading size="md">Time Parameters</Heading>
                </HStack>

                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Payment Frequency (seconds)
                        </FormLabel>
                        <NumberInput
                            value={form.frequency}
                            onChange={(value) => setForm({ ...form, frequency: Number(value) })}
                            min={60}
                            size="lg"
                        >
                            <NumberInputField
                                bg={inputBg}
                                border="2px solid"
                                borderColor={borderColor}
                                borderRadius="lg"
                                _hover={{ borderColor: "#081781" }}
                                _focus={{
                                    borderColor: "#081781",
                                    boxShadow: "0 0 0 1px #081781",
                                    bg: cardBg
                                }}
                            />
                            <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                            </NumberInputStepper>
                        </NumberInput>
                        <HStack mt={2} spacing={2}>
                            <Badge colorScheme="blue" variant="subtle">
                                Minimum: 60 sec
                            </Badge>
                            <Text fontSize="sm" color={textColor}>
                                ({Math.round(form.frequency / 60)} min)
                            </Text>
                        </HStack>
                    </FormControl>

                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Waiting Period (seconds)
                        </FormLabel>
                        <NumberInput
                            value={form.waitingPeriod}
                            onChange={(value) => setForm({ ...form, waitingPeriod: Number(value) })}
                            min={120}
                            size="lg"
                        >
                            <NumberInputField
                                bg={inputBg}
                                border="2px solid"
                                borderColor={borderColor}
                                borderRadius="lg"
                                _hover={{ borderColor: "#081781" }}
                                _focus={{
                                    borderColor: "#081781",
                                    boxShadow: "0 0 0 1px #081781",
                                    bg: cardBg
                                }}
                            />
                            <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                            </NumberInputStepper>
                        </NumberInput>
                        <HStack mt={2} spacing={2}>
                            <Badge colorScheme="orange" variant="subtle">
                                Minimum: 120 sec
                            </Badge>
                            <Text fontSize="sm" color={textColor}>
                                ({Math.round(form.waitingPeriod / 60)} min)
                            </Text>
                        </HStack>
                    </FormControl>
                </Grid>

                <Box mt={4} p={4} bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="lg">
                    <Text fontSize="sm" color={textColor}>
                        <strong>Waiting Period</strong> - time after which the heir will be able to receive funds
                        if you do not show activity on the network.
                    </Text>
                </Box>
            </Box>

            {/* Create button */}
            <Box pt={4}>
                <Button
                    colorScheme="purple"
                    onClick={handleSubmit}
                    isLoading={loading}
                    loadingText="Creating will..."
                    isDisabled={
                        !form.heir ||
                        !form.heirName ||
                        !form.heirRole ||
                        !form.transferAmount ||
                        !form.limit ||
                        !!networkError ||
                        parseFloat(form.limit) < parseFloat(form.transferAmount)
                    }
                    size="xl"
                    width="100%"
                    py={6}
                    fontSize="lg"
                    fontWeight="bold"
                    bgGradient="linear(to-r, #081781, #061264)"
                    _hover={{
                        bgGradient: "linear(to-r, #061264, #040d47)",
                        transform: "translateY(-2px)",
                        boxShadow: "xl"
                    }}
                    _active={{ transform: "translateY(0)" }}
                    transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    borderRadius="xl"
                    leftIcon={<Icon as={FaShieldAlt} />}
                >
                    Create Smart Will
                </Button>

                {parseFloat(form.limit) < parseFloat(form.transferAmount) && form.limit && form.transferAmount && (
                    <Alert status="warning" mt={4} borderRadius="lg" variant="modern">
                        <AlertIcon />
                        <AlertDescription>
                            Limit must be greater than or equal to transfer amount
                        </AlertDescription>
                    </Alert>
                )}
            </Box>
        </VStack>
    );
}