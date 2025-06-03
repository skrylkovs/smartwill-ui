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

// Конфигурация приложения
const CONFIG = {
    // API-ключ Arbiscan - замените на свой реальный ключ
    ARBISCAN_API_KEY: "EER1P87Y4I6R4JT9K3KYRWTVWET72VGH5V",
    // Адрес новой фабрики смарт-контрактов с исправлениями безопасности
    FACTORY_ADDRESS: "0x48D5CbBa0c6A47D2d6a8952b85826c3E0ba82ba3"
};

// Типы режимов приложения
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

    // Загрузка режима приложения из localStorage при инициализации
    useEffect(() => {
        const savedMode = localStorage.getItem('smartwill-app-mode') as AppMode;
        if (savedMode && (savedMode === "testator" || savedMode === "heir")) {
            setAppMode(savedMode);
            // Если режим наследника, автоматически переключаемся на соответствующую вкладку
            if (savedMode === "heir") {
                setActiveTab("heirWills");
            } else {
                setActiveTab("myWills");
            }
        }
    }, []);

    // Автоматическая коррекция вкладки при смене режима
    useEffect(() => {
        if (appMode === "heir" && activeTab !== "heirWills") {
            setActiveTab("heirWills");
        } else if (appMode === "testator" && activeTab === "heirWills") {
            setActiveTab("myWills");
        }
    }, [appMode, activeTab]);

    // Сохранение режима приложения в localStorage при изменении
    const handleModeChange = (newMode: AppMode) => {
        setAppMode(newMode);
        localStorage.setItem('smartwill-app-mode', newMode);

        // Автоматически переключаем вкладку в зависимости от режима
        if (newMode === "heir") {
            setActiveTab("heirWills");
        } else {
            setActiveTab("myWills");
        }
    };

    // Функция для подключения к кошельку
    const connect = async () => {
        if (!window.ethereum) return alert("Установите MetaMask");
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        setProvider(web3Provider);
        setSigner(signer);
        setAccount(address);
    };

    // Автоматически подключаемся к кошельку при загрузке страницы
    useEffect(() => {
        const autoConnect = async () => {
            // Проверяем, доступен ли MetaMask
            if (!window.ethereum) {
                console.log("MetaMask не установлен");
                return;
            }

            try {
                // Проверяем, есть ли уже подключенные аккаунты
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });

                if (accounts && accounts.length > 0) {
                    console.log("Автоматическое подключение к MetaMask");
                    connect();
                } else {
                    console.log("Нет подключенных аккаунтов");
                }
            } catch (error) {
                console.error("Ошибка при автоматическом подключении:", error);
            }
        };

        autoConnect();

        // Добавляем обработчики событий MetaMask
        const setupEventListeners = () => {
            if (!window.ethereum) return;

            // Обработка события смены аккаунта
            window.ethereum.on('accountsChanged', (accounts: string[]) => {
                if (accounts.length === 0) {
                    // Пользователь отключил кошелек
                    console.log("Кошелек отключен");
                    setAccount("");
                    setSigner(null);
                    setProvider(null);
                } else {
                    // Пользователь сменил аккаунт
                    console.log("Аккаунт изменен на:", accounts[0]);
                    connect();
                }
            });

            // Обработка события смены сети
            window.ethereum.on('chainChanged', () => {
                console.log("Сеть изменена, обновляем подключение");
                connect();
            });

            // Обработка события отключения
            window.ethereum.on('disconnect', () => {
                console.log("Кошелек отключен");
                setAccount("");
                setSigner(null);
                setProvider(null);
            });
        };

        setupEventListeners();

        // Очистка обработчиков при размонтировании компонента
        return () => {
            if (window.ethereum) {
                window.ethereum.removeAllListeners();
            }
        };
    }, []);

    // Проверяем сеть при подключении
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
                console.error("Ошибка при получении информации о сети:", err);
            }
        };

        checkNetwork();
    }, [provider]);

    // Обработчик события создания завещания
    const handleWillCreated = () => {
        // Убеждаемся, что мы в режиме завещателя и переключаемся на вкладку "Мои завещания"
        if (appMode !== "testator") {
            setAppMode("testator");
            localStorage.setItem('smartwill-app-mode', "testator");
        }

        setActiveTab("myWills");

        // Даем небольшую задержку для переключения вкладки
        setTimeout(() => {
            // Если есть ссылка на компонент MyWills, вызываем обновление
            if (myWillsRef.current && typeof myWillsRef.current.loadWills === 'function') {
                myWillsRef.current.loadWills();
            }
        }, 100);
    };

    // Проверяем, находимся ли мы на правильной сети (Arbitrum Sepolia)
    const isCorrectNetwork = network && network.chainId === 421614;

    const bgGradient = useColorModeValue(
        'linear-gradient(135deg, #081781 0%, #061264 100%)',
        'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)'
    );

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');

    return (
        <Box bg={useColorModeValue('gray.50', 'gray.900')} minH="100vh">
            {/* Современный хедер */}
            <Box
                bgGradient={bgGradient}
                py={6}
                px={6}
                boxShadow="xl"
                position="relative"
                overflow="hidden"
            >
                {/* Декоративные элементы */}
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
                                            "Создавайте и управляйте завещаниями" :
                                            "Проверяйте доступное наследство"
                                        ) :
                                        "Цифровое наследство на блокчейне"
                                    }
                                </Text>
                            </VStack>
                        </HStack>

                        {/* Переключатель режимов (показываем только при подключенном кошельке) */}
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
                                                Завещатель
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
                                                Наследник
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
                                    {appMode === "testator" ? "Режим завещателя" : "Режим наследника"}
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
                                        Фабрика подключена
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
                                <AlertTitle>Неверная сеть!</AlertTitle>
                                <AlertDescription>
                                    Вы подключены к сети {network.name || `Chain ID: ${network.chainId}`}.
                                    Пожалуйста, переключитесь на Arbitrum Sepolia в вашем кошельке.
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
                                        Управляйте своими цифровыми активами
                                    </Heading>
                                    <Text fontSize="xl" color={textColor} maxW="700px" lineHeight="tall">
                                        SmartWill помогает создавать умные завещания на блокчейне,
                                        обеспечивая безопасную передачу ваших криптоактивов наследникам.
                                    </Text>
                                </VStack>

                                {/* Преимущества */}
                                <HStack spacing={8} pt={8}>
                                    <VStack spacing={2}>
                                        <Icon as={FaShieldAlt} boxSize={8} color="green.500" />
                                        <Text fontWeight="semibold">Безопасность</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Защищено блокчейном
                                        </Text>
                                    </VStack>
                                    <VStack spacing={2}>
                                        <Icon as={FaFileContract} boxSize={8} color="blue.500" />
                                        <Text fontWeight="semibold">Автоматизация</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Умные контракты
                                        </Text>
                                    </VStack>
                                    <VStack spacing={2}>
                                        <Icon as={FaWallet} boxSize={8} color="#081781" />
                                        <Text fontWeight="semibold">Простота</Text>
                                        <Text fontSize="sm" color={textColor} textAlign="center">
                                            Легкое управление
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
                                    Подключить кошелек
                                </Button>
                            </VStack>
                        </Box>
                    ) : (
                        <>
                            {/* Навигационные кнопки */}
                            <Box
                                bg={cardBg}
                                borderRadius="xl"
                                p={2}
                                boxShadow="lg"
                                width="100%"
                                maxW="1200px"
                            >
                                <HStack spacing={2}>
                                    {/* Режим завещателя - показываем "Создать завещание" и "Мои завещания" */}
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
                                                Создать завещание
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
                                                Мои завещания
                                            </Button>
                                        </>
                                    )}

                                    {/* Режим наследника - показываем только "Моё наследство" */}
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
                                            Моё наследство
                                        </Button>
                                    )}
                                </HStack>
                            </Box>

                            {/* Основной контент */}
                            <Box
                                p={8}
                                borderRadius="xl"
                                bg={cardBg}
                                boxShadow="xl"
                                width="100%"
                                border="1px solid"
                                borderColor={useColorModeValue('gray.200', 'gray.700')}
                            >
                                {/* Режим завещателя */}
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

                                {/* Режим наследника */}
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
