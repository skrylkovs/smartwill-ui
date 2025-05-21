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
    const [showMyWills, setShowMyWills] = useState(false);
    const [factoryAddress, setFactoryAddress] = useState<string>("");
    const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
    const [isLoadingFactory, setIsLoadingFactory] = useState(false);
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

    const connect = async () => {
        if (!window.ethereum) return alert("Установите MetaMask");
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner();
        const address = await signer.getAddress();
        setProvider(web3Provider);
        setSigner(signer);
        setAccount(address);
    };
    
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
                toast({
                    title: "Фабрики не найдены",
                    description: "С вашего адреса не было создано контрактов",
                    status: "warning",
                    duration: 5000
                });
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
            toast({
                title: "Фабрика не найдена",
                description: "Среди созданных контрактов не найдено фабрик SmartWillFactory",
                status: "warning",
                duration: 5000
            });
            
        } catch (err: any) {
            console.error("Ошибка при поиске фабрики:", err);
            toast({
                title: "Ошибка поиска фабрики",
                description: err.message || "Произошла ошибка при поиске фабрики",
                status: "error",
                duration: 5000
            });
        } finally {
            setIsLoadingFactory(false);
        }
    };

    // Проверяем, находимся ли мы на правильной сети (Arbitrum Sepolia)
    const isCorrectNetwork = network && network.chainId === 421614;

    return (
        <Container py={6}>
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
                                <Text mb={3}>Необходимо развернуть фабрику контрактов или найти существующую</Text>
                                <VStack spacing={3} align="stretch">
                                    {isLoadingFactory ? (
                                        <Alert status="info" borderRadius="md">
                                            <AlertIcon />
                                            <AlertDescription>Выполняется поиск вашей фабрики SmartWillFactory...</AlertDescription>
                                        </Alert>
                                    ) : (
                                        <DeployFactoryButton 
                                            signer={signer!} 
                                            onFactoryDeployed={handleFactoryDeployed} 
                                        />
                                    )}
                                </VStack>
                            </Box>
                        ) : (
                            <>
                                <Text>Адрес фабрики: {factoryAddress}</Text>
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