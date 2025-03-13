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

const FACTORY_ADDRESS = "0x358B00a05019308373f0F6E61b7A2d9044f299F6"; // Адрес вашей фабрики

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

    const toast = useToast();
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        try {
            const factory = new ethers.Contract(FACTORY_ADDRESS, factoryAbi.abi, signer);
            const tx = await factory.createSmartWill(
                form.heir,
                ethers.parseEther(form.transferAmount),
                Number(form.frequency),
                Number(form.waitingPeriod),
                { value: ethers.parseEther(form.deposit) }
            );
            const receipt = await tx.wait();
            const event = receipt.logs.find((log: any) => log.fragment?.name === "WillCreated");
            const newAddress = event?.args?.willAddress;
            if (newAddress) {
                onWillCreated(newAddress);
                toast({ title: "Завещание создано", description: newAddress, status: "success" });
            }
        } catch (err: any) {
            toast({ title: "Ошибка", description: err.message, status: "error" });
        }
    };

    return (
        <Box p={4} borderWidth={1} borderRadius="md">
            <VStack spacing={3}>
                <FormControl>
                    <FormLabel>Адрес наследника</FormLabel>
                    <Input name="heir" onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Сумма перевода (ETH)</FormLabel>
                    <Input name="transferAmount" onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Частота выплат (секунды)</FormLabel>
                    <Input name="frequency" onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Период ожидания (секунды)</FormLabel>
                    <Input name="waitingPeriod" onChange={handleChange} />
                </FormControl>
                <FormControl>
                    <FormLabel>Депозит (ETH)</FormLabel>
                    <Input name="deposit" onChange={handleChange} />
                </FormControl>
                <Button colorScheme="green" onClick={handleSubmit}>
                    Создать завещание
                </Button>
            </VStack>
        </Box>
    );
}