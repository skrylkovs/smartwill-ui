import { useEffect, useState, useRef } from "react";
import { ethers } from "ethers";
import {
    Button,
    Container,
    Heading,
    Text,
    VStack,
    HStack,
} from "@chakra-ui/react";
import CreateWillForm from "./components/CreateWillForm";
import MyWills from "./components/MyWills";
import factoryAbi from "./contracts/SmartWillFactory.json";

const FACTORY_ADDRESS = "0x4Acc5767812147106a51E5b8292151A136eC81ba";

function App() {
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [signer, setSigner] = useState<ethers.Signer | null>(null);
    const [account, setAccount] = useState<string>("");
    const [showMyWills, setShowMyWills] = useState(false);
    const myWillsRef = useRef<any>(null);

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

    return (
        <Container py={6}>
            <VStack spacing={6}>
                <Heading>💼 SmartWill</Heading>
                {!account ? (
                    <Button onClick={connect}>Подключить кошелек</Button>
                ) : (
                    <>
                        <Text>Кошелек: {account}</Text>
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
                            />
                        ) : (
                            <CreateWillForm signer={signer!} onWillCreated={handleWillCreated} />
                        )}
                    </>
                )}
            </VStack>
        </Container>
    );
}

export default App;