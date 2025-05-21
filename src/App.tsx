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
    AlertDescription
} from "@chakra-ui/react";
import CreateWillForm from "./components/CreateWillForm";
import MyWills from "./components/MyWills";
import DeployFactoryButton from "./components/DeployFactoryButton";
import factoryAbi from "./contracts/SmartWillFactory.json";

function App() {
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [account, setAccount] = useState<string>("");
    const [showMyWills, setShowMyWills] = useState(false);
    const [factoryAddress, setFactoryAddress] = useState<string>("");
    const [network, setNetwork] = useState<{ chainId: number; name: string } | null>(null);
    const myWillsRef = useRef<any>(null);

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
                                <Text mb={3}>Необходимо развернуть фабрику контрактов</Text>
                                <DeployFactoryButton 
                                    signer={signer!} 
                                    onFactoryDeployed={handleFactoryDeployed} 
                                />
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