import { useState, useEffect } from "react";
import {
    Box,
    Button,
    FormControl,
    FormLabel,
    Input,
    VStack,
    useToast,
    Text,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Grid,
    Heading
} from "@chakra-ui/react";
import { ethers } from "ethers";
import factoryAbi from "../contracts/SmartWillFactory.json";

interface Props {
    signer: ethers.Signer;
    onWillCreated: (address: string) => void;
    factoryAddress: string;
}

export default function CreateWillForm({ signer, onWillCreated, factoryAddress }: Props) {
    const [form, setForm] = useState({
        heir: "",
        heirName: "",
        heirRole: "",
        transferAmount: "",
        frequency: 180,
        waitingPeriod: 300,
        limit: ""
    });
    const [loading, setLoading] = useState(false);
    const [networkError, setNetworkError] = useState<string | null>(null);

    const toast = useToast();
    
    // Проверка сети при загрузке компонента
    useEffect(() => {
        const checkNetwork = async () => {
            try {
                if (!signer) return;
                
                // Получаем информацию о сети
                const provider = signer.provider as ethers.BrowserProvider;
                const network = await provider.getNetwork();
                const chainId = Number(network.chainId);
                
                // ID сети Arbitrum Sepolia: 421614
                if (chainId !== 421614) {
                    setNetworkError("Пожалуйста, переключитесь на сеть Arbitrum Sepolia в вашем кошельке");
                } else {
                    setNetworkError(null);
                }
            } catch (err) {
                console.error("Ошибка при проверке сети:", err);
            }
        };
        
        checkNetwork();
    }, [signer]);
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async () => {
        try {
            // Сначала проверяем сеть
            const provider = signer.provider as ethers.BrowserProvider;
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);
            
            // ID сети Arbitrum Sepolia: 421614
            if (chainId !== 421614) {
                throw new Error("Пожалуйста, переключитесь на сеть Arbitrum Sepolia в вашем кошельке");
            }
            
            setLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            
            const minFrequency = 60;
            const minWaitingPeriod = 120;
            
            const frequency = Math.max(Number(form.frequency), minFrequency);
            const waitingPeriod = Math.max(Number(form.waitingPeriod), minWaitingPeriod);
            
            const transferAmountWei = ethers.parseEther(form.transferAmount);
            const limitWei = ethers.parseEther(form.limit);
            
            if (limitWei < transferAmountWei) {
                throw new Error("Лимит должен быть больше или равен сумме перевода");
            }
            
            // Добавляем gas limit для решения проблемы с estimateGas
            const gasLimit = ethers.toBigInt(800000); // Увеличенный gas limit
            
            const tx = await factory.createSmartWill(
                form.heir,
                form.heirName,
                form.heirRole,
                ethers.parseEther(form.transferAmount),
                frequency,
                waitingPeriod,
                limitWei,
                { 
                    value: limitWei,
                    gasLimit: gasLimit 
                }
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
                
                setForm({
                    heir: "",
                    heirName: "",
                    heirRole: "",
                    transferAmount: "",
                    frequency: 180,
                    waitingPeriod: 300,
                    limit: ""
                });
                
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
        <Box>
            {networkError && (
                <Alert status="error" mb={6} borderRadius="lg" variant="left-accent" boxShadow="sm">
                    <AlertIcon />
                    <Box>
                        <AlertTitle>Ошибка сети!</AlertTitle>
                        <AlertDescription>{networkError}</AlertDescription>
                    </Box>
                </Alert>
            )}
            
            <Box mb={8}>
                <Heading size="md" fontWeight="semibold" mb={4}>Создание нового завещания</Heading>
                <Text color="gray.600" fontSize="md">
                    Заполните данные для создания умного завещания на блокчейне
                </Text>
            </Box>
            
            <Grid 
                templateColumns={{ base: "1fr", md: "1fr 1fr" }} 
                gap={6}
            >
                <FormControl>
                    <FormLabel fontWeight="medium">Ф.И.О. наследника</FormLabel>
                    <Input 
                        name="heirName" 
                        value={form.heirName} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        placeholder="Иванов Иван Иванович"
                    />
                </FormControl>
                
                <FormControl>
                    <FormLabel fontWeight="medium">Роль наследника</FormLabel>
                    <Input 
                        name="heirRole" 
                        value={form.heirRole} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        placeholder="Сын"
                    />
                </FormControl>
                
                <FormControl>
                    <FormLabel fontWeight="medium">Кошелек наследника</FormLabel>
                    <Input 
                        name="heir" 
                        value={form.heir} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        placeholder="0x..."
                        fontFamily="monospace"
                    />
                </FormControl>
                
                <FormControl>
                    <FormLabel fontWeight="medium">Сумма регулярного перевода</FormLabel>
                    <Input 
                        name="transferAmount" 
                        value={form.transferAmount} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        placeholder="0.001"
                    />
                </FormControl>
                
                <FormControl>
                    <FormLabel fontWeight="medium">Частота выплат (секунды)</FormLabel>
                    <Input 
                        name="frequency" 
                        value={form.frequency} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        type="number"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>Минимум: 60 секунд (1 минута)</Text>
                </FormControl>
                
                <FormControl>
                    <FormLabel fontWeight="medium">Период ожидания (секунды)</FormLabel>
                    <Input 
                        name="waitingPeriod" 
                        value={form.waitingPeriod} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        type="number"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>Минимум: 120 секунд (2 минуты)</Text>
                </FormControl>
                
                <FormControl gridColumn={{ md: "span 2" }}>
                    <FormLabel fontWeight="medium">Лимит</FormLabel>
                    <Input 
                        name="limit" 
                        value={form.limit} 
                        onChange={handleChange} 
                        bg="white"
                        borderColor="gray.300"
                        _hover={{ borderColor: "purple.300" }}
                        _focus={{ borderColor: "purple.500", boxShadow: "0 0 0 1px #8E54E9" }}
                        placeholder="0.005"
                    />
                    <Text fontSize="xs" color="gray.500" mt={1}>Должен быть не меньше суммы перевода</Text>
                </FormControl>
            </Grid>
            
            <Box mt={8} textAlign="center">
                <Button 
                    colorScheme="purple" 
                    onClick={handleSubmit} 
                    isLoading={loading}
                    loadingText="Создание..."
                    isDisabled={!form.heir || !form.heirName || !form.heirRole || !form.transferAmount || !form.limit || !!networkError}
                    size="lg"
                    width={{ base: "100%", md: "auto" }}
                    px={10}
                    py={6}
                    boxShadow="md"
                    _hover={{ transform: "translateY(-2px)", boxShadow: "lg" }}
                    transition="all 0.2s"
                >
                    Создать завещание
                </Button>
            </Box>
        </Box>
    );
}