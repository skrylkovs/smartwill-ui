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
    Heading,
    useColorModeValue,
    Icon,
    HStack,
    Divider,
    NumberInput,
    NumberInputField,
    NumberInputStepper,
    NumberIncrementStepper,
    NumberDecrementStepper,
    Badge
} from "@chakra-ui/react";
import { FaUser, FaEthereum, FaClock, FaShieldAlt } from "react-icons/fa";
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
            const gasLimit = ethers.toBigInt(1000000); // Увеличенный gas limit
            
            // Логируем параметры для отладки
            console.log("🔧 Параметры для createSmartWill:");
            console.log("- heir:", form.heir);
            console.log("- heirName:", form.heirName);
            console.log("- heirRole:", form.heirRole);
            console.log("- transferAmount:", ethers.formatEther(transferAmountWei), "ETH");
            console.log("- frequency:", frequency, "секунд");
            console.log("- waitingPeriod:", waitingPeriod, "секунд");
            console.log("- limit:", ethers.formatEther(limitWei), "ETH");
            console.log("- value:", ethers.formatEther(limitWei), "ETH");
            console.log("- gasLimit:", gasLimit.toString());
            
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

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const inputBg = useColorModeValue('gray.50', 'gray.700');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    return (
        <VStack spacing={8} align="stretch">
            {networkError && (
                <Alert 
                    status="error" 
                    borderRadius="xl" 
                    variant="modern"
                    bg={cardBg}
                >
                    <AlertIcon />
                    <Box>
                        <AlertTitle>Ошибка сети!</AlertTitle>
                        <AlertDescription>{networkError}</AlertDescription>
                    </Box>
                </Alert>
            )}
            
            {/* Заголовок */}
            <Box textAlign="center">
                <HStack justify="center" mb={4}>
                    <Icon as={FaShieldAlt} boxSize={8} color="#081781" />
                    <Heading size="lg" bgGradient="linear(to-r, #081781, #061264)" bgClip="text">
                        Создание завещания
                    </Heading>
                </HStack>
                <Text color={textColor} fontSize="lg" maxW="600px" mx="auto">
                    Создайте умное завещание для безопасной передачи ваших криптоактивов
                </Text>
            </Box>

            <Divider />

            {/* Информация о наследнике */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaUser} color="blue.500" />
                    <Heading size="md">Информация о наследнике</Heading>
                </HStack>
                
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Полное имя наследника
                        </FormLabel>
                        <Input 
                            name="heirName" 
                            value={form.heirName} 
                            onChange={handleChange} 
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{ 
                                borderColor: "#081781", 
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="Иванов Иван Иванович"
                            size="lg"
                        />
                    </FormControl>
                    
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Степень родства
                        </FormLabel>
                        <Input 
                            name="heirRole" 
                            value={form.heirRole} 
                            onChange={handleChange} 
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{ 
                                borderColor: "#081781", 
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="Сын, дочь, супруг(а)"
                            size="lg"
                        />
                    </FormControl>
                    
                    <FormControl gridColumn={{ md: "span 2" }}>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Адрес кошелька наследника
                        </FormLabel>
                        <Input 
                            name="heir" 
                            value={form.heir} 
                            onChange={handleChange} 
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{ 
                                borderColor: "#081781", 
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0x742d35Cc6634C0532925a3b8D4C9db96590c6C87"
                            fontFamily="monospace"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Ethereum-адрес кошелька, на который будут переводиться средства
                        </Text>
                    </FormControl>
                </Grid>
            </Box>

            <Divider />

            {/* Финансовые параметры */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaEthereum} color="green.500" />
                    <Heading size="md">Финансовые параметры</Heading>
                </HStack>
                
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Сумма регулярного перевода (ETH)
                        </FormLabel>
                        <Input 
                            name="transferAmount" 
                            value={form.transferAmount} 
                            onChange={handleChange} 
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{ 
                                borderColor: "#081781", 
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0.001"
                            type="number"
                            step="0.001"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Сумма, которая будет переводиться наследнику регулярно
                        </Text>
                    </FormControl>
                    
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Общий лимит (ETH)
                        </FormLabel>
                        <Input 
                            name="limit" 
                            value={form.limit} 
                            onChange={handleChange} 
                            bg={inputBg}
                            border="2px solid"
                            borderColor={borderColor}
                            borderRadius="lg"
                            _hover={{ borderColor: "#081781" }}
                            _focus={{ 
                                borderColor: "#081781", 
                                boxShadow: "0 0 0 1px #081781",
                                bg: cardBg
                            }}
                            placeholder="0.005"
                            type="number"
                            step="0.001"
                            size="lg"
                        />
                        <Text fontSize="sm" color={textColor} mt={2}>
                            Максимальная сумма, которая может быть переведена
                        </Text>
                    </FormControl>
                </Grid>
            </Box>

            <Divider />

            {/* Временные параметры */}
            <Box>
                <HStack mb={6}>
                    <Icon as={FaClock} color="orange.500" />
                    <Heading size="md">Временные параметры</Heading>
                </HStack>
                
                <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={6}>
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Частота выплат (секунды)
                        </FormLabel>
                        <NumberInput 
                            value={form.frequency} 
                            onChange={(value) => setForm({ ...form, frequency: Number(value) })}
                            min={60}
                            size="lg"
                        >
                            <NumberInputField 
                                bg={inputBg}
                                border="2px solid"
                                borderColor={borderColor}
                                borderRadius="lg"
                                _hover={{ borderColor: "#081781" }}
                                _focus={{ 
                                    borderColor: "#081781", 
                                    boxShadow: "0 0 0 1px #081781",
                                    bg: cardBg
                                }}
                            />
                            <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                            </NumberInputStepper>
                        </NumberInput>
                        <HStack mt={2} spacing={2}>
                            <Badge colorScheme="blue" variant="subtle">
                                Минимум: 60 сек
                            </Badge>
                            <Text fontSize="sm" color={textColor}>
                                ({Math.round(form.frequency / 60)} мин)
                            </Text>
                        </HStack>
                    </FormControl>
                    
                    <FormControl>
                        <FormLabel fontWeight="semibold" color={textColor}>
                            Период ожидания (секунды)
                        </FormLabel>
                        <NumberInput 
                            value={form.waitingPeriod} 
                            onChange={(value) => setForm({ ...form, waitingPeriod: Number(value) })}
                            min={120}
                            size="lg"
                        >
                            <NumberInputField 
                                bg={inputBg}
                                border="2px solid"
                                borderColor={borderColor}
                                borderRadius="lg"
                                _hover={{ borderColor: "#081781" }}
                                _focus={{ 
                                    borderColor: "#081781", 
                                    boxShadow: "0 0 0 1px #081781",
                                    bg: cardBg
                                }}
                            />
                            <NumberInputStepper>
                                <NumberIncrementStepper />
                                <NumberDecrementStepper />
                            </NumberInputStepper>
                        </NumberInput>
                        <HStack mt={2} spacing={2}>
                            <Badge colorScheme="orange" variant="subtle">
                                Минимум: 120 сек
                            </Badge>
                            <Text fontSize="sm" color={textColor}>
                                ({Math.round(form.waitingPeriod / 60)} мин)
                            </Text>
                        </HStack>
                    </FormControl>
                </Grid>
                
                <Box mt={4} p={4} bg={useColorModeValue('blue.50', 'blue.900')} borderRadius="lg">
                    <Text fontSize="sm" color={textColor}>
                        <strong>Период ожидания</strong> - время, через которое наследник сможет получить средства, 
                        если вы не проявляете активность в сети.
                    </Text>
                </Box>
            </Box>

            {/* Кнопка создания */}
            <Box pt={4}>
                <Button 
                    colorScheme="purple" 
                    onClick={handleSubmit} 
                    isLoading={loading}
                    loadingText="Создание завещания..."
                    isDisabled={
                        !form.heir || 
                        !form.heirName || 
                        !form.heirRole || 
                        !form.transferAmount || 
                        !form.limit || 
                        !!networkError ||
                        parseFloat(form.limit) < parseFloat(form.transferAmount)
                    }
                    size="xl"
                    width="100%"
                    py={6}
                    fontSize="lg"
                    fontWeight="bold"
                    bgGradient="linear(to-r, #081781, #061264)"
                    _hover={{ 
                        bgGradient: "linear(to-r, #061264, #040d47)",
                        transform: "translateY(-2px)", 
                        boxShadow: "xl" 
                    }}
                    _active={{ transform: "translateY(0)" }}
                    transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                    borderRadius="xl"
                    leftIcon={<Icon as={FaShieldAlt} />}
                >
                    Создать умное завещание
                </Button>
                
                {parseFloat(form.limit) < parseFloat(form.transferAmount) && form.limit && form.transferAmount && (
                    <Alert status="warning" mt={4} borderRadius="lg" variant="modern">
                        <AlertIcon />
                        <AlertDescription>
                            Лимит должен быть больше или равен сумме перевода
                        </AlertDescription>
                    </Alert>
                )}
            </Box>
        </VStack>
    );
}