import { useState } from "react";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    useToast
} from "@chakra-ui/react";
import { ethers } from "ethers";
import factoryAbi from "../contracts/SmartWillFactory.json";

const FACTORY_ADDRESS = "0x4Acc5767812147106a51E5b8292151A136eC81ba"; // Адрес вашей фабрики

interface Props {
    signer: ethers.Signer;
    onWillCreated: (address: string) => void;
}

export default function CreateWillForm({ signer, onWillCreated }: Props) {
    const [form, setForm] = useState({
        heir: "",
        transferAmount: "",
        frequency: 60,
        waitingPeriod: 180,
        deposit: ""
    });
    const [loading, setLoading] = useState(false);

    const toast = useToast();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        try {
            setLoading(true);
            const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi.abi, signer);
            const tx = await factory.createSmartWill(
                form.heir,
                ethers.parseEther(form.transferAmount),
                Number(form.frequency),
                Number(form.waitingPeriod),
                { value: ethers.parseEther(form.deposit) }
            );
            
            toast({ 
                title: "Транзакция отправлена", 
                description: "Ожидание подтверждения...", 
                status: "info",
                duration: 5000
            });
            
            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment?.name === "WillCreated");
            const newAddress = event?.args?.willAddress;
            
            if (newAddress) {
                toast({ 
                    title: "Завещание создано", 
                    description: `Новое завещание по адресу: ${newAddress}`, 
                    status: "success",
                    duration: 5000
                });
                
                // Очистка формы
                setForm({
                    heir: "",
                    transferAmount: "",
                    frequency: 60,
                    waitingPeriod: 180,
                    deposit: ""
                });
                
                // Вызываем коллбек для переключения на вкладку "Мои завещания"
                onWillCreated(newAddress);
            }
        } catch (err: any) {
            toast({ 
                title: "Ошибка", 
                description: err.message, 
                status: "error",
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Box p={4} borderWidth={1} borderRadius="md">
            <VStack spacing={3}>
                <FormControl>
                    <FormLabel>Адрес наследника</FormLabel>
                    <Input name="heir" value={form.heir} onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Сумма перевода (ETH)</FormLabel>
                    <Input name="transferAmount" value={form.transferAmount} onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Частота выплат (секунды)</FormLabel>
                    <Input name="frequency" value={form.frequency} onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Период ожидания (секунды)</FormLabel>
                    <Input name="waitingPeriod" value={form.waitingPeriod} onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Депозит (ETH)</FormLabel>
                    <Input name="deposit" value={form.deposit} onChange={handleChange} />
                </FormControl>
                <Button 
                    colorScheme="green" 
                    onClick={handleSubmit} 
                    isLoading={loading}
                    loadingText="Создание..."
                    isDisabled={!form.heir || !form.transferAmount || !form.deposit}
                >
                    Создать завещание
                </Button>
            </VStack>
        </Box>
    );
}