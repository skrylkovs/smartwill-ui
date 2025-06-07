import { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import {
    Button,
    Container,
    Heading,
    Text,
    VStack,
    HStack,
    Box,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Flex,
    useColorModeValue,
    Badge,
    Icon,
    Switch,
    FormControl,
    FormLabel
} from "@chakra-ui/react";
import { FaWallet, FaFileContract, FaShieldAlt, FaGift, FaUserTie, FaHeart } from "react-icons/fa";
import CreateWillForm from "./components/CreateWillForm";
import MyWills from "./components/MyWills";
import HeirWills from "./components/HeirWills";

// Application configuration
const CONFIG = {
    // Arbiscan API key - replace with your real key
    ARBISCAN_API_KEY: "EER1P87Y4I6R4JT9K3KYRWTVWET72VGH5V",
    // New factory address with security fixes and fallback functions
    FACTORY_ADDRESS: "0xb83Fc3E89cF00E2697Cc6ecFe1cC989C7441CBd9"
};

// Application mode types
type AppMode = "testator" | "heir";

function App() {
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [account, setAccount] = useState<string>("");
    const [activeTab, setActiveTab] = useState<"create" | "myWills" | "heirWills">("myWills");
    const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
    const [appMode, setAppMode] = useState<AppMode>("testator");
    const myWillsRef = useRef<any>(null);
    const heirWillsRef = useRef<any>(null);

    // Load app mode from localStorage on initialization
    useEffect(() => {
        const savedMode = localStorage.getItem('smartwill-app-mode') as AppMode;
        if (savedMode && (savedMode === "testator" || savedMode === "heir")) {
            setAppMode(savedMode);
            // If heir mode, automatically switch to the corresponding tab
            if (savedMode === "heir") {
                setActiveTab("heirWills");
            } else {
                setActiveTab("myWills");
            }
        }
    }, []);

    // Automatic tab correction when mode changes
    useEffect(() => {
        if (appMode === "heir" && activeTab !== "heirWills") {
            setActiveTab("heirWills");
        } else if (appMode === "testator" && activeTab === "heirWills") {
            setActiveTab("myWills");
        }
    }, [appMode, activeTab]);

    // Save app mode to localStorage when changed
    const handleModeChange = (newMode: AppMode) => {
        setAppMode(newMode);
        localStorage.setItem('smartwill-app-mode', newMode);

        // Automatically switch tab depending on mode
        if (newMode === "heir") {
            setActiveTab("heirWills");
        } else {
            setActiveTab("myWills");
        }
    };

    // Function to connect to wallet
    const connect = async () => {
        if (!window.ethereum) return alert("Please install MetaMask");
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        setProvider(web3Provider);
        setSigner(signer);
        setAccount(address);
    };

    // Automatically connect to wallet on page load
    useEffect(() => {
        const autoConnect = async () => {
            // Check if MetaMask is available
            if (!window.ethereum) {
                console.log("MetaMask not installed");
                return;
            }

            try {
                // Check if there are already connected accounts
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });

                if (accounts && accounts.length > 0) {
                    console.log("Auto-connecting to MetaMask");
                    connect();
                } else {
                    console.log("No connected accounts");
                }
            } catch (error) {
                console.error("Error during auto-connect:", error);
            }
        };

        autoConnect();

        // Add MetaMask event listeners
        const setupEventListeners = () => {
            if (!window.ethereum) return;

            // Handle account change event
            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    // User disconnected wallet
                    console.log("Wallet disconnected");
                    setAccount("");
                    setSigner(null);
                    setProvider(null);
                } else {
                    // User changed account
                    console.log("Account changed to:", accounts[0]);
                    connect();
                }
            });

            // Handle network change event
            window.ethereum.on('chainChanged', () => {
                console.log("Network changed, updating connection");
                connect();
            });

            // Handle disconnect event
            window.ethereum.on('disconnect', () => {
                console.log("Wallet disconnected");
                setAccount("");
                setSigner(null);
                setProvider(null);
            });
        };

        setupEventListeners();

        // Clean up listeners when component unmounts
        return () => {
            if (window.ethereum) {
                window.ethereum.removeAllListeners();
            }
        };
    }, []);

    // Check network when connected
    useEffect(() => {
        const checkNetwork = async () => {
            if (!provider) return;
            try {
                const network = await provider.getNetwork();
                setNetwork({
                    chainId: Number(network.chainId),
                    name: network.name
                });
            } catch (err) {
                console.error("Error getting network information:", err);
            }
        };

        checkNetwork();
    }, [provider]);

    // Will creation event handler
    const handleWillCreated = () => {
        // Make sure we're in testator mode and switch to "My Wills" tab
        if (appMode !== "testator") {
            setAppMode("testator");
            localStorage.setItem('smartwill-app-mode', "testator");
        }

        setActiveTab("myWills");

        // Give a small delay for tab switching
        setTimeout(() => {
            // If there's a reference to MyWills component, call update
            if (myWillsRef.current && typeof myWillsRef.current.loadWills === 'function') {
                myWillsRef.current.loadWills();
            }
        }, 100);
    };

    // Check if we're on the correct network (Arbitrum Sepolia)
    const isCorrectNetwork = network && network.chainId === 421614;

    const bgGradient = useColorModeValue(
        'linear-gradient(135deg, #081781 0%, #061264 100%)',
        'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)'
    );

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');

    return (
        <Box bg={useColorModeValue('gray.50', 'gray.900')} minH="100vh">
            {/* Modern header */}
            <Box
                bgGradient={bgGradient}
                py={6}
                px={6}
                boxShadow="xl"
                position="relative"
                overflow="hidden"
            >
                {/* Decorative elements */}
                <Box
                    position="absolute"
                    top="-50%"
                    right="-10%"
                    width="300px"
                    height="300px"
                    borderRadius="full"
                    bg="whiteAlpha.100"
                    filter="blur(100px)"
                />
                <Box
                    position="absolute"
                    bottom="-30%"
                    left="-5%"
                    width="200px"
                    height="200px"
                    borderRadius="full"
                    bg="whiteAlpha.50"
                    filter="blur(80px)"
                />

                <Container maxW="container.xl" position="relative" zIndex={1}>
                    <Flex justifyContent="space-between" alignItems="center">
                        <HStack spacing={4}>
                            <Icon as={FaShieldAlt} boxSize={8} color="white" />
                            <VStack align="start" spacing={0}>
                                <Heading size="lg" color="white" fontWeight="bold">
                                    SmartWill
                                </Heading>
                                <Text fontSize="sm" color="whiteAlpha.800">
                                    {account ?
                                        (appMode === "testator" ?
                                            "Create and manage wills" :
                                            "Check available inheritance"
                                        ) :
                                        "Digital inheritance on blockchain"
                                    }
                                </Text>
                            </VStack>
                        </HStack>

                        {/* Mode switch (show only when wallet is connected) */}
                        {account && (
                            <VStack spacing={2}>
                                <FormControl display="flex" alignItems="center" justifyContent="center">
                                    <HStack spacing={3}>
                                        <HStack>
                                            <Icon as={FaUserTie} color={appMode === "testator" ? "white" : "whiteAlpha.600"} />
                                            <FormLabel
                                                htmlFor="mode-switch"
                                                mb={0}
                                                fontSize="sm"
                                                color={appMode === "testator" ? "white" : "whiteAlpha.600"}
                                                fontWeight={appMode === "testator" ? "bold" : "normal"}
                                            >
                                                Testator
                                            </FormLabel>
                                        </HStack>
                                        <Switch
                                            id="mode-switch"
                                            colorScheme="orange"
                                            isChecked={appMode === "heir"}
                                            onChange={(e) => handleModeChange(e.target.checked ? "heir" : "testator")}
                                            size="lg"
                                        />
                                        <HStack>
                                            <FormLabel
                                                htmlFor="mode-switch"
                                                mb={0}
                                                fontSize="sm"
                                                color={appMode === "heir" ? "white" : "whiteAlpha.600"}
                                                fontWeight={appMode === "heir" ? "bold" : "normal"}
                                            >
                                                Heir
                                            </FormLabel>
                                            <Icon as={FaHeart} color={appMode === "heir" ? "white" : "whiteAlpha.600"} />
                                        </HStack>
                                    </HStack>
                                </FormControl>
                                <Badge
                                    colorScheme={appMode === "testator" ? "blue" : "orange"}
                                    variant="solid"
                                    fontSize="xs"
                                    bg={appMode === "testator" ? "blue.100" : "orange.100"}
                                    color={appMode === "testator" ? "blue.800" : "orange.800"}
                                    px={3}
                                    py={1}
                                    borderRadius="full"
                                >
                                    {appMode === "testator" ? "Testator Mode" : "Heir Mode"}
                                </Badge>
                            </VStack>
                        )}

                        <HStack spacing={4}>
                            {account && (
                                <VStack align="end" spacing={1}>
                                    <HStack>
                                        <Icon as={FaWallet} color="white" />
                                        <Text fontSize="sm" color="white" fontWeight="medium">
                                            {`${account.slice(0, 6)}...${account.slice(-4)}`}
                                        </Text>
                                    </HStack>
                                    <Badge
                                        colorScheme="blue"
                                        variant="solid"
                                        fontSize="xs"
                                        bg="blue.100"
                                        color="blue.800"
                                        px={3}
                                        py={1}
                                        borderRadius="full"
                                    >
                                        Factory Connected
                                    </Badge>
                                </VStack>
                            )}
                        </HStack>
                    </Flex>
                </Container>
            </Box>

            <Container py={12} maxW="container.xl">
                <VStack spacing={8}>
                    {!isCorrectNetwork && network && (
                        <Alert
                            status="warning"
                            borderRadius="xl"
                            boxShadow="lg"
                            variant="modern"
                            bg={cardBg}
                        >
                            <AlertIcon />
                            <Box>
                                <AlertTitle>Wrong Network!</AlertTitle>
                                <AlertDescription>
                                    You are connected to {network.name || `Chain ID: ${network.chainId}`}.
                                    Please switch to Arbitrum Sepolia in your wallet.
                                </AlertDescription>
                            </Box>
                        </Alert>
                    )}

                    {!account ? (
                        <Box textAlign="center" py={16}>
                            <VStack spacing={8}>
                                <VStack spacing={4}>
                                    <Icon as={FaFileContract} boxSize={16} color="#081781" />
                                    <Heading size="2xl" bgGradient="linear(to-r, #081781, #061264)" bgClip="text">
                                        Manage Your Digital Assets
                                    </Heading>
                                    <Text fontSize="xl" color={textColor} maxW="700px" lineHeight="tall">
                                        SmartWill helps create smart wills on blockchain,
                                        ensuring secure transfer of your crypto assets to heirs.
                                    </Text>
                                </VStack>

                                {/* Benefits */}
                                <HStack spacing={8} pt={8}>
                                    <VStack spacing={2}>
                                        <Icon as={FaShieldAlt} boxSize={8} color="green.500" />
                                        <Text fontWeight="semibold">Security</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Protected by blockchain
                                        </Text>
                                    </VStack>
                                    <VStack spacing={2}>
                                        <Icon as={FaFileContract} boxSize={8} color="blue.500" />
                                        <Text fontWeight="semibold">Automation</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Smart contracts
                                        </Text>
                                    </VStack>
                                    <VStack spacing={2}>
                                        <Icon as={FaWallet} boxSize={8} color="#081781" />
                                        <Text fontWeight="semibold">Simplicity</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Easy management
                                        </Text>
                                    </VStack>
                                </HStack>

                                <Button
                                    onClick={connect}
                                    size="xl"
                                    colorScheme="purple"
                                    px={12}
                                    py={6}
                                    fontSize="lg"
                                    leftIcon={<FaWallet />}
                                    bgGradient="linear(to-r, #081781, #061264)"
                                    _hover={{
                                        bgGradient: "linear(to-r, #061264, #040d47)",
                                        transform: "translateY(-2px)",
                                        boxShadow: "xl"
                                    }}
                                    _active={{ transform: "translateY(0)" }}
                                    transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                                    borderRadius="xl"
                                >
                                    Connect Wallet
                                </Button>
                            </VStack>
                        </Box>
                    ) : (
                        <>
                            {/* Navigation buttons */}
                            <Box
                                bg={cardBg}
                                borderRadius="xl"
                                p={2}
                                boxShadow="lg"
                                width="100%"
                                maxW="1200px"
                            >
                                <HStack spacing={2}>
                                    {/* Testator mode - show "Create Will" and "My Wills" */}
                                    {appMode === "testator" && (
                                        <>
                                            <Button
                                                onClick={() => setActiveTab("create")}
                                                colorScheme={activeTab === "create" ? "purple" : "gray"}
                                                variant={activeTab === "create" ? "solid" : "ghost"}
                                                flex={1}
                                                size="lg"
                                                borderRadius="lg"
                                                leftIcon={<Icon as={FaFileContract} />}
                                                bgGradient={activeTab === "create" ? "linear(to-r, #081781, #061264)" : undefined}
                                                _hover={{
                                                    transform: activeTab === "create" ? "none" : "translateY(-1px)",
                                                    bg: activeTab === "create" ? undefined : useColorModeValue('gray.100', 'gray.700'),
                                                    bgGradient: activeTab === "create" ? "linear(to-r, #061264, #040d47)" : undefined
                                                }}
                                                transition="all 0.2s"
                                            >
                                                Create Will
                                            </Button>
                                            <Button
                                                onClick={() => setActiveTab("myWills")}
                                                colorScheme={activeTab === "myWills" ? "purple" : "gray"}
                                                variant={activeTab === "myWills" ? "solid" : "ghost"}
                                                flex={1}
                                                size="lg"
                                                borderRadius="lg"
                                                leftIcon={<Icon as={FaWallet} />}
                                                bgGradient={activeTab === "myWills" ? "linear(to-r, #081781, #061264)" : undefined}
                                                _hover={{
                                                    transform: activeTab === "myWills" ? "none" : "translateY(-1px)",
                                                    bg: activeTab === "myWills" ? undefined : useColorModeValue('gray.100', 'gray.700'),
                                                    bgGradient: activeTab === "myWills" ? "linear(to-r, #061264, #040d47)" : undefined
                                                }}
                                                transition="all 0.2s"
                                            >
                                                My Wills
                                            </Button>
                                        </>
                                    )}

                                    {/* Heir mode - show only "My Inheritance" */}
                                    {appMode === "heir" && (
                                        <Button
                                            onClick={() => setActiveTab("heirWills")}
                                            colorScheme="green"
                                            variant="solid"
                                            flex={1}
                                            size="lg"
                                            borderRadius="lg"
                                            leftIcon={<Icon as={FaGift} />}
                                            bgGradient="linear(to-r, green.500, green.600)"
                                            _hover={{
                                                bgGradient: "linear(to-r, green.600, green.700)"
                                            }}
                                            transition="all 0.2s"
                                        >
                                            My Inheritance
                                        </Button>
                                    )}
                                </HStack>
                            </Box>

                            {/* Main content */}
                            <Box
                                p={8}
                                borderRadius="xl"
                                bg={cardBg}
                                boxShadow="xl"
                                width="100%"
                                border="1px solid"
                                borderColor={useColorModeValue('gray.200', 'gray.700')}
                            >
                                {/* Testator mode */}
                                {appMode === "testator" && (
                                    <>
                                        {activeTab === "create" && (
                                            <CreateWillForm
                                                signer={signer!}
                                                onWillCreated={handleWillCreated}
                                                factoryAddress={CONFIG.FACTORY_ADDRESS}
                                            />
                                        )}
                                        {activeTab === "myWills" && (
                                            <MyWills
                                                signer={signer!}
                                                ref={myWillsRef}
                                                factoryAddress={CONFIG.FACTORY_ADDRESS}
                                            />
                                        )}
                                    </>
                                )}

                                {/* Heir mode */}
                                {appMode === "heir" && (
                                    <HeirWills
                                        signer={signer!}
                                        ref={heirWillsRef}
                                        factoryAddress={CONFIG.FACTORY_ADDRESS}
                                    />
                                )}
                            </Box>
                        </>
                    )}
                </VStack>
            </Container>
        </Box>
    );
}

export default App;