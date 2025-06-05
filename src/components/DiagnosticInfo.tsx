import { useState } from "react";
import { ethers } from "ethers";
import {
    Box,
    Button,
    Text,
    VStack,
    HStack,
    Heading,
    Alert,
    AlertIcon,
    AlertDescription,
    Code,
    Divider,
    useColorModeValue,
    Badge,
    Icon,
    Collapse,
    useDisclosure
} from "@chakra-ui/react";
import { FaBug, FaInfoCircle } from "react-icons/fa";
import factoryAbi from "../contracts/SmartWillFactory.json";

interface DiagnosticInfoProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

const DiagnosticInfo = ({ signer, factoryAddress }: DiagnosticInfoProps) => {
    const [diagnostics, setDiagnostics] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const { isOpen, onToggle } = useDisclosure();

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');

    const runDiagnostics = async () => {
        try {
            setLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const userAddress = await signer.getAddress();
            const provider = signer.provider as ethers.BrowserProvider;
            const network = await provider.getNetwork();

            const results = {
                userAddress,
                factoryAddress,
                network: {
                    name: network.name,
                    chainId: Number(network.chainId)
                },
                allWills: [],
                myWills: [],
                error: null
            };

            try {
                // Check all wills
                const allWills = await factory.getDeployedWills();
                results.allWills = allWills;

                // Check my wills
                const myWills = await factory.getMyWills();
                results.myWills = myWills;
            } catch (error: any) {
                results.error = error.message;
            }

            setDiagnostics(results);
        } catch (error) {
            console.error("Diagnostic error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box>
            <Button
                onClick={onToggle}
                size="sm"
                variant="outline"
                colorScheme="orange"
                leftIcon={<Icon as={FaBug} />}
                mb={4}
            >
                {isOpen ? "Hide Diagnostics" : "Show Diagnostics"}
            </Button>

            <Collapse in={isOpen} animateOpacity>
                <Box
                    p={6}
                    borderRadius="xl"
                    bg={cardBg}
                    border="2px solid"
                    borderColor="orange.200"
                    boxShadow="md"
                    mb={6}
                >
                    <VStack spacing={4} align="stretch">
                        <HStack spacing={3}>
                            <Icon as={FaInfoCircle} color="orange.500" boxSize={5} />
                            <Heading size="md" color="orange.500">
                                Diagnostic Information
                            </Heading>
                        </HStack>

                        <Button
                            onClick={runDiagnostics}
                            isLoading={loading}
                            loadingText="Running diagnostics..."
                            colorScheme="orange"
                            variant="outline"
                            size="md"
                        >
                            Run Diagnostics
                        </Button>

                        {diagnostics && (
                            <VStack spacing={4} align="stretch">
                                <Divider />

                                <VStack spacing={3} align="stretch">
                                    <Text fontWeight="bold">Connection Information:</Text>
                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                                        <VStack spacing={2} align="stretch" fontSize="sm">
                                            <HStack justify="space-between">
                                                <Text color={textColor}>Your Address:</Text>
                                                <Code>{diagnostics.userAddress}</Code>
                                            </HStack>
                                            <HStack justify="space-between">
                                                <Text color={textColor}>Factory:</Text>
                                                <Code>{diagnostics.factoryAddress}</Code>
                                            </HStack>
                                            <HStack justify="space-between">
                                                <Text color={textColor}>Network:</Text>
                                                <Badge colorScheme="blue">
                                                    {diagnostics.network.name} (ID: {diagnostics.network.chainId})
                                                </Badge>
                                            </HStack>
                                        </VStack>
                                    </Box>
                                </VStack>

                                <VStack spacing={3} align="stretch">
                                    <Text fontWeight="bold">Query Results:</Text>
                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="md">
                                        <VStack spacing={2} align="stretch" fontSize="sm">
                                            <HStack justify="space-between">
                                                <Text color={textColor}>Total wills in factory:</Text>
                                                <Badge colorScheme="purple" variant="solid">
                                                    {diagnostics.allWills.length}
                                                </Badge>
                                            </HStack>
                                            <HStack justify="space-between">
                                                <Text color={textColor}>Your wills:</Text>
                                                <Badge
                                                    colorScheme={diagnostics.myWills.length > 0 ? "green" : "red"}
                                                    variant="solid"
                                                >
                                                    {diagnostics.myWills.length}
                                                </Badge>
                                            </HStack>
                                        </VStack>
                                    </Box>
                                </VStack>

                                {diagnostics.myWills.length > 0 && (
                                    <VStack spacing={3} align="stretch">
                                        <Text fontWeight="bold">Your will addresses:</Text>
                                        <Box p={3} bg={useColorModeValue('green.50', 'green.900')} borderRadius="md">
                                            {diagnostics.myWills.map((address: string, index: number) => (
                                                <Text key={index} fontSize="sm" fontFamily="monospace" color="green.600">
                                                    {index + 1}. {address}
                                                </Text>
                                            ))}
                                        </Box>
                                    </VStack>
                                )}

                                {diagnostics.error && (
                                    <Alert status="error" borderRadius="md">
                                        <AlertIcon />
                                        <AlertDescription>{diagnostics.error}</AlertDescription>
                                    </Alert>
                                )}

                                {diagnostics.myWills.length === 0 && !diagnostics.error && (
                                    <Alert status="warning" borderRadius="md">
                                        <AlertIcon />
                                        <AlertDescription>
                                            No wills found. They may have been created on an old factory
                                            or haven't been confirmed on the network yet.
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </VStack>
                        )}
                    </VStack>
                </Box>
            </Collapse>
        </Box>
    );
};

export default DiagnosticInfo;