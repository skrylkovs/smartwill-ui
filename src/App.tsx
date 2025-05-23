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
    useToast
} from "@chakra-ui/react";
import CreateWillForm from "./components/CreateWillForm";
import MyWills from "./components/MyWills";
import DeployFactoryButton from "./components/DeployFactoryButton";
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

    return (
        <Container py={6} maxW="container.lg">
            <VStack spacing={6}>
                <Heading>💼 SmartWill</Heading>
                
                <Alert status="info" borderRadius="md">
                    <AlertIcon />
                    <AlertDescription>
                        Контракт работает в сети <strong>Arbitrum Sepolia</strong>. Убедитесь, что ваш кошелек подключен к этой сети.
                    </AlertDescription>
                </Alert>
                
                {!account ? (
                    <Button onClick={connect}>Подключить кошелек</Button>
                ) : (
                    <>
                        <Text>Кошелек: {account}</Text>
                        {network && !isCorrectNetwork && (
                            <Alert status="warning" borderRadius="md">
                                <AlertIcon />
                                <AlertTitle>Неверная сеть!</AlertTitle>
                                <AlertDescription>
                                    Вы подключены к сети {network.name || `Chain ID: ${network.chainId}`}. 
                                    Пожалуйста, переключитесь на Arbitrum Sepolia в вашем кошельке.
                                </AlertDescription>
                            </Alert>
                        )}
                        
                        {!factoryAddress ? (
                            <Box>
                                <Text mb={3}>Выполняется поиск или создание фабрики контрактов...</Text>
                                <VStack spacing={3} align="stretch">
                                    {isLoadingFactory ? (
                                        <Alert status="info" borderRadius="md">
                                            <AlertIcon />
                                            <AlertDescription>Выполняется поиск вашей фабрики SmartWillFactory...</AlertDescription>
                                        </Alert>
                                    ) : isDeployingFactory ? (
                                        <Alert status="info" borderRadius="md">
                                            <AlertIcon />
                                            <AlertDescription>Выполняется создание новой фабрики...</AlertDescription>
                                        </Alert>
                                    ) : (
                                        <>
                                            <Alert status="warning" borderRadius="md">
                                                <AlertIcon />
                                                <AlertDescription>Не удалось найти или создать фабрику автоматически.</AlertDescription>
                                            </Alert>
                                            {/* Кнопка скрыта
                                            <DeployFactoryButton 
                                                signer={signer!} 
                                                onFactoryDeployed={handleFactoryDeployed} 
                                            />
                                            */}
                                        </>
                                    )}
                                </VStack>
                            </Box>
                        ) : (
                            <>
                                <HStack justifyContent="space-between" align="center" w="100%">
                                    <Text>Адрес фабрики: {factoryAddress}</Text>
                                    {/* Кнопка скрыта
                                    <DeployFactoryButton 
                                        signer={signer!} 
                                        onFactoryDeployed={handleFactoryDeployed} 
                                    />
                                    */}
                                </HStack>
                                <HStack spacing={4}>
                                    <Button onClick={() => setShowMyWills(false)} colorScheme={!showMyWills ? "blue" : "gray"}>
                                        Создать завещание
                                    </Button>
                                    <Button onClick={() => setShowMyWills(true)} colorScheme={showMyWills ? "blue" : "gray"}>
                                        Мои завещания
                                    </Button>
                                </HStack>
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
                            </>
                        )}
                    </>
                )}
            </VStack>
        </Container>
    );
}

export default App;