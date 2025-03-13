import { useState } from "react";
import { ethers } from "ethers";
import { Box, Button, Input, Text, VStack, Heading } from "@chakra-ui/react";
import contractData from "./SmartWill.json";

const abi = contractData.abi;
const bytecode = contractData.bytecode;

function App() {
    const [account, setAccount] = useState<string | null>(null);
    const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
    const [contractAddress, setContractAddress] = useState<string | null>(null);
    const [contractInstance, setContractInstance] = useState<ethers.Contract | null>(null);

    async function connectWallet() {
        if (!window.ethereum) {
            alert("Установите MetaMask!");
            return;
        }
        const web3Provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await web3Provider.getSigner(); // ✅ Запрашиваем кошелек пользователя
        const userAccount = await signer.getAddress();
        setAccount(userAccount);
        setProvider(web3Provider);
    }

    async function createSmartWill() {
        if (!provider || !account) return alert("Подключите кошелек!");

        const signer = await provider.getSigner(account); // ✅ Исправленный getSigner()

        const contractFactory = new ethers.ContractFactory(abi, bytecode, signer);
        try {
            const contract = await contractFactory.deploy(
                "0x0Db16194f9906d62f7C3953A3E46C5AB47bcF1e5",
                ethers.parseEther("0.00001"),
                60,
                60 * 3,
                { value: ethers.parseEther("0.0001") }
            );

            await contract.waitForDeployment();
            const newContractAddress = await contract.getAddress();
            setContractAddress(newContractAddress);

            // ✅ Сохраняем инстанс контракта для вызова `ping()`
            const contractInstance = new ethers.Contract(newContractAddress, abi, signer);
            setContractInstance(contractInstance);

            alert(`✅ Смарт-завещание создано! Адрес: ${newContractAddress}`);
        } catch (error) {
            console.error("Ошибка при создании контракта:", error);
        }
    }

    async function sendPing() {
        if (!contractInstance) {
            alert("Сначала создайте смарт-завещание!");
            return;
        }

        try {
            const tx = await contractInstance.ping();
            await tx.wait();
            alert("✅ PING отправлен!");
        } catch (error) {
            console.error("Ошибка при отправке PING:", error);
        }
    }

    return (
        <VStack spacing={4} p={6}>
            <Heading>💼 Смарт-Завещание</Heading>
            {!account ? (
                <Button onClick={connectWallet} colorScheme="teal">Подключить MetaMask</Button>
            ) : (
                <>
                    <Text>👤 Ваш кошелек: {account}</Text>
                    <Button onClick={createSmartWill} colorScheme="green" mt={2}>Создать завещание</Button>

                    {contractAddress && (
                        <Box borderWidth="1px" p={4} borderRadius="md" w="100%">
                            <Heading size="md">🔍 Информация о завещании</Heading>
                            <Text>📍 Адрес контракта: {contractAddress}</Text>
                            <Button onClick={sendPing} colorScheme="blue" mt={2}>Я еще жив</Button>
                        </Box>
                    )}
                </>
            )}
        </VStack>
    );
}

export default App;