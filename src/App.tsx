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
    useToast,
    Flex,
    useColorModeValue,
    Badge,
    Icon,
    Divider
} from "@chakra-ui/react";
import { FaWallet, FaFileContract, FaShieldAlt } from "react-icons/fa";
import CreateWillForm from "./components/CreateWillForm";
import MyWills from "./components/MyWills";
import DeployFactoryButton from "./components/DeployFactoryButton";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import factoryAbi from "./contracts/SmartWillFactory.json";

// Конфигурация приложения
const CONFIG = {
    // API-ключ Arbiscan - замените на свой реальный ключ
    ARBISCAN_API_KEY: "EER1P87Y4I6R4JT9K3KYRWTVWET72VGH5V"
};

// Интерфейс для транзакции из Arbiscan API
interface ArbiscanTransaction {
    blockNumber: string;
    timeStamp: string;
    hash: string;
    from: string;
    to: string;
    value: string;
    contractAddress: string;
    input: string;
    isError: string;
    txreceipt_status: string;
}

function App() {
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [account, setAccount] = useState<string>("");
    const [showMyWills, setShowMyWills] = useState(true);
    const [factoryAddress, setFactoryAddress] = useState<string>("");
    const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
    const [isLoadingFactory, setIsLoadingFactory] = useState(false);
    const [isDeployingFactory, setIsDeployingFactory] = useState(false);
    const myWillsRef = useRef<any>(null);
    const toast = useToast();

    // Загружаем адрес фабрики при инициализации
    useEffect(() => {
        const savedAddress = localStorage.getItem("factoryAddress");
        if (savedAddress) {
            setFactoryAddress(savedAddress);
            console.log('Загружен адрес фабрики:', savedAddress);
        }
    }, []);
    
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
    
    // Автоматический поиск фабрики при подключении кошелька
    useEffect(() => {
        // Если есть адрес кошелька и нет адреса фабрики, запускаем поиск
        if (account && signer && !factoryAddress) {
            findLatestFactory();
        }
    }, [account, signer, factoryAddress]);

    // Обработчик события создания завещания
    const handleWillCreated = (willAddress: string) => {
        // Переключаемся на вкладку "Мои завещания"
        setShowMyWills(true);
        
        // Даем небольшую задержку для переключения вкладки
        setTimeout(() => {
            // Если есть ссылка на компонент MyWills, вызываем обновление
            if (myWillsRef.current && typeof myWillsRef.current.loadWills === 'function') {
                myWillsRef.current.loadWills();
            }
        }, 100);
    };

    // Обработчик деплоя фабрики
    const handleFactoryDeployed = (address: string) => {
        setFactoryAddress(address);
        toast({
            title: "Фабрика контрактов изменена",
            description: "Адрес новой фабрики успешно сохранен. Все завещания будут создаваться через эту фабрику.",
            status: "success",
            duration: 5000
        });
        
        // Очищаем старые данные
        if (myWillsRef.current && typeof myWillsRef.current.loadWills === 'function') {
            // Перезагружаем список завещаний, если компонент MyWills загружен
            myWillsRef.current.loadWills();
        }
    };
    
    // Функция для создания новой фабрики
    const deployFactory = async () => {
        if (!signer) {
            console.error("Не подключен кошелек");
            return;
        }
        
        try {
            setIsDeployingFactory(true);
            
            toast({
                title: "Автоматическое создание фабрики",
                description: "Так как существующая фабрика не найдена, создаем новую...",
                status: "info",
                duration: 5000
            });
            
            // Создаем фабрику контрактов
            const factory = new ethers.ContractFactory(
                factoryAbi.abi,
                factoryAbi.bytecode,
                signer
            );
            
            // Деплоим контракт
            const contract = await factory.deploy();
            
            toast({
                title: "Транзакция отправлена",
                description: "Ожидание подтверждения...",
                status: "info",
                duration: 5000
            });
            
            // Ждем завершения деплоя
            await contract.waitForDeployment();
            
            // Получаем адрес нового контракта
            const contractAddress = await contract.getAddress();
            
            // Сохраняем адрес в localStorage
            localStorage.setItem("factoryAddress", contractAddress);
            
            toast({
                title: "Фабрика развернута",
                description: `Адрес фабрики: ${contractAddress}`,
                status: "success",
                duration: 5000
            });
            
            // Устанавливаем адрес фабрики
            setFactoryAddress(contractAddress);
            
        } catch (err: any) {
            console.error("Ошибка при создании фабрики:", err);
            toast({
                title: "Ошибка создания фабрики",
                description: err.message || "Произошла ошибка при создании фабрики",
                status: "error",
                duration: 5000
            });
        } finally {
            setIsDeployingFactory(false);
        }
    };
    
    // Функция для получения транзакций пользователя через Arbiscan API
    const getTransactionsFromArbiscan = async (address: string): Promise<ArbiscanTransaction[]> => {
        const apiKey = CONFIG.ARBISCAN_API_KEY;
        
        if (!apiKey || apiKey === "ВАИШ_ARBISCAN_API_КЛЮЧ") {
            throw new Error("API ключ Arbiscan не настроен в конфигурации приложения");
        }
        
        const url = `https://api-sepolia.arbiscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&sort=desc&apikey=${apiKey}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status !== "1") {
            throw new Error(`Ошибка Arbiscan API: ${data.message}`);
        }
        
        return data.result as ArbiscanTransaction[];
    };
    
    // Проверка, является ли контракт фабрикой SmartWillFactory
    const isSmartWillFactory = async (contractAddress: string): Promise<boolean> => {
        if (!provider) return false;
        
        try {
            // Проверяем, есть ли код по этому адресу
            const code = await provider.getCode(contractAddress);
            if (code === '0x') return false;
            
            // Создаем экземпляр контракта
            const contract = new ethers.Contract(contractAddress, factoryAbi.abi, provider);
            
            try {
                // Пытаемся вызвать метод getDeployedWills, который должен быть у фабрики
                await contract.getDeployedWills();
                return true;
            } catch (err) {
                return false;
            }
        } catch (err) {
            return false;
        }
    };
    
    // Функция для получения последней фабрики по адресу кошелька через Arbiscan API
    const findLatestFactory = async () => {
        if (!signer || !account) {
            console.log("Не подключен кошелек, поиск фабрики невозможен");
            return;
        }
        
        try {
            setIsLoadingFactory(true);
            console.log("Ищем вашу последнюю фабрику SmartWillFactory через Arbiscan...");
            
            // Получаем все транзакции пользователя
            const transactions = await getTransactionsFromArbiscan(account);
            
            // Фильтруем транзакции, где создаются контракты
            // contractAddress будет не пустым, если транзакция создала контракт
            const contractCreations = transactions.filter(tx => 
                tx.contractAddress !== "" && 
                tx.isError === "0" && 
                tx.from.toLowerCase() === account.toLowerCase()
            );
            
            if (contractCreations.length === 0) {
                console.log("С вашего адреса не было создано контрактов, создаем новую фабрику");
                await deployFactory();
                return;
            }
            
            console.log(`Найдено ${contractCreations.length} транзакций создания контрактов`);
            
            // Проверяем каждый созданный контракт, начиная с самого последнего
            for (const tx of contractCreations) {
                const contractAddress = tx.contractAddress;
                console.log(`Проверяем контракт: ${contractAddress}`);
                
                const isFactory = await isSmartWillFactory(contractAddress);
                
                if (isFactory) {
                    // Сохраняем адрес фабрики
                    localStorage.setItem("factoryAddress", contractAddress);
                    setFactoryAddress(contractAddress);
                    
                    toast({
                        title: "Фабрика найдена",
                        description: `Найдена ваша фабрика по адресу: ${contractAddress}`,
                        status: "success",
                        duration: 5000
                    });
                    return;
                }
            }
            
            // Если ни один из контрактов не является фабрикой
            console.log("Среди созданных контрактов не найдено фабрик SmartWillFactory, создаем новую");
            await deployFactory();
            
        } catch (err: any) {
            console.error("Ошибка при поиске фабрики:", err);
            toast({
                title: "Ошибка поиска фабрики",
                description: err.message || "Произошла ошибка при поиске фабрики",
                status: "error",
                duration: 5000
            });
            
            // При ошибке поиска также пытаемся создать новую фабрику
            try {
                console.log("Пытаемся создать новую фабрику после ошибки поиска");
                await deployFactory();
            } catch (deployErr) {
                console.error("Не удалось создать фабрику после ошибки поиска:", deployErr);
            }
        } finally {
            setIsLoadingFactory(false);
        }
    };

    // Проверяем, находимся ли мы на правильной сети (Arbitrum Sepolia)
    const isCorrectNetwork = network && network.chainId === 421614;

    const bgGradient = useColorModeValue(
        'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
                
                <Container maxW="container.lg" position="relative" zIndex={1}>
                    <Flex justifyContent="space-between" alignItems="center">
                        <HStack spacing={4}>
                            <Icon as={FaShieldAlt} boxSize={8} color="white" />
                            <VStack align="start" spacing={0}>
                                <Heading size="lg" color="white" fontWeight="bold">
                                    SmartWill
                                </Heading>
                                <Text fontSize="sm" color="whiteAlpha.800">
                                    Цифровое наследство на блокчейне
                                </Text>
                            </VStack>
                        </HStack>
                        
                        <HStack spacing={4}>
                            <ThemeToggle />
                            {account && (
                                <VStack align="end" spacing={1}>
                                    <HStack>
                                        <Icon as={FaWallet} color="white" />
                                        <Text fontSize="sm" color="white" fontWeight="medium">
                                            {`${account.slice(0, 6)}...${account.slice(-4)}`}
                                        </Text>
                                    </HStack>
                                    {factoryAddress && (
                                        <Badge colorScheme="green" variant="subtle" fontSize="xs">
                                            Фабрика подключена
                                        </Badge>
                                    )}
                                </VStack>
                            )}
                        </HStack>
                    </Flex>
                </Container>
            </Box>
            
            <Container py={12} maxW="container.lg">
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
                                    <Icon as={FaFileContract} boxSize={16} color="purple.500" />
                                    <Heading size="2xl" bgGradient="linear(to-r, purple.400, purple.600)" bgClip="text">
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
                                        <Icon as={FaWallet} boxSize={8} color="purple.500" />
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
                                    bgGradient="linear(to-r, purple.500, purple.600)"
                                    _hover={{ 
                                        bgGradient: "linear(to-r, purple.600, purple.700)",
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
                            {!factoryAddress ? (
                                <Box 
                                    w="100%" 
                                    p={8} 
                                    bg={cardBg}
                                    borderRadius="xl"
                                    boxShadow="lg"
                                >
                                    <VStack spacing={6}>
                                        <Heading size="md">Настройка фабрики контрактов</Heading>
                                        <Divider />
                                        {isLoadingFactory ? (
                                            <Alert status="info" borderRadius="xl" variant="modern">
                                                <AlertIcon />
                                                <AlertDescription>
                                                    Выполняется поиск вашей фабрики SmartWillFactory...
                                                </AlertDescription>
                                            </Alert>
                                        ) : isDeployingFactory ? (
                                            <Alert status="info" borderRadius="xl" variant="modern">
                                                <AlertIcon />
                                                <AlertDescription>
                                                    Выполняется создание новой фабрики...
                                                </AlertDescription>
                                            </Alert>
                                        ) : (
                                            <Alert status="warning" borderRadius="xl" variant="modern">
                                                <AlertIcon />
                                                <AlertDescription>
                                                    Не удалось найти или создать фабрику автоматически.
                                                </AlertDescription>
                                            </Alert>
                                        )}
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
                                        maxW="500px"
                                    >
                                        <HStack spacing={2}>
                                            <Button 
                                                onClick={() => setShowMyWills(false)} 
                                                colorScheme={!showMyWills ? "purple" : "gray"}
                                                variant={!showMyWills ? "solid" : "ghost"}
                                                flex={1}
                                                size="lg"
                                                borderRadius="lg"
                                                leftIcon={<Icon as={FaFileContract} />}
                                                _hover={{ 
                                                    transform: !showMyWills ? "none" : "translateY(-1px)",
                                                    bg: !showMyWills ? undefined : useColorModeValue('gray.100', 'gray.700')
                                                }}
                                                transition="all 0.2s"
                                            >
                                                Создать завещание
                                            </Button>
                                            <Button 
                                                onClick={() => setShowMyWills(true)} 
                                                colorScheme={showMyWills ? "purple" : "gray"}
                                                variant={showMyWills ? "solid" : "ghost"}
                                                flex={1}
                                                size="lg"
                                                borderRadius="lg"
                                                leftIcon={<Icon as={FaWallet} />}
                                                _hover={{ 
                                                    transform: showMyWills ? "none" : "translateY(-1px)",
                                                    bg: showMyWills ? undefined : useColorModeValue('gray.100', 'gray.700')
                                                }}
                                                transition="all 0.2s"
                                            >
                                                Мои завещания
                                            </Button>
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
                                        {showMyWills ? (
                                            <MyWills 
                                                signer={signer!} 
                                                ref={myWillsRef}
                                                factoryAddress={factoryAddress}
                                            />
                                        ) : (
                                            <CreateWillForm 
                                                signer={signer!} 
                                                onWillCreated={handleWillCreated}
                                                factoryAddress={factoryAddress} 
                                            />
                                        )}
                                    </Box>
                                </>
                            )}
                        </>
                    )}
                </VStack>
            </Container>
        </Box>
    );
}

export default App;