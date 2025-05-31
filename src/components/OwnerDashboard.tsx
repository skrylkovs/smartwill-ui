import { useState, useEffect } from "react";
import {
    Box,
    Button,
    VStack,
    HStack,
    Text,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Heading,
    useColorModeValue,
    Icon,
    Badge,
    useToast,
    Card,
    CardBody,
    CardHeader,
    Progress
} from "@chakra-ui/react";
import { FaHeart, FaClock, FaEthereum, FaUser, FaShieldAlt, FaCheck } from "react-icons/fa";
import { ethers } from "ethers";
import smartWillAbi from "../contracts/SmartWill.json";

interface Props {
    signer: ethers.Signer;
    willAddress: string;
}

interface WillInfo {
    owner: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: bigint;
    balance: bigint;
    isOwnerActive: boolean;
    lastActivity: bigint;
    willActivateWaitingPeriod: bigint;
    transferFrequency: bigint;
    nextPossibleTransferTime: bigint;
}

export default function OwnerDashboard({ signer, willAddress }: Props) {
    const [willInfo, setWillInfo] = useState<WillInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [confirmLoading, setConfirmLoading] = useState(false);
    const [timeUntilInactive, setTimeUntilInactive] = useState<number>(0);
    const [countdown, setCountdown] = useState<string>("");

    const toast = useToast();
    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');

    const loadWillInfo = async () => {
        try {
            setLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);
            
            const [
                owner,
                heir,
                heirName,
                heirRole,
                transferAmount,
                balance,
                isOwnerActive,
                lastActivity,
                willActivateWaitingPeriod,
                transferFrequency,
                nextPossibleTransferTime
            ] = await Promise.all([
                will.owner(),
                will.heir(),
                will.heirName(),
                will.heirRole(),
                will.transferAmount(),
                will.getBalance(),
                will.isOwnerActive(),
                will.lastActivity(),
                will.willActivateWaitingPeriod(),
                will.transferFrequency(),
                will.getNextPossibleTransferTime()
            ]);

            setWillInfo({
                owner,
                heir,
                heirName,
                heirRole,
                transferAmount,
                balance,
                isOwnerActive,
                lastActivity,
                willActivateWaitingPeriod,
                transferFrequency,
                nextPossibleTransferTime
            });

        } catch (error: any) {
            toast({
                title: "Ошибка загрузки",
                description: error.message,
                status: "error",
                duration: 5000
            });
        } finally {
            setLoading(false);
        }
    };

    const calculateTimeUntilInactive = () => {
        if (!willInfo) return;

        const currentTime = Math.floor(Date.now() / 1000);
        const inactiveTime = Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod);
        const timeLeft = inactiveTime - currentTime;

        setTimeUntilInactive(timeLeft);

        if (timeLeft > 0) {
            const hours = Math.floor(timeLeft / 3600);
            const minutes = Math.floor((timeLeft % 3600) / 60);
            const seconds = timeLeft % 60;
            
            if (hours > 0) {
                setCountdown(`${hours}ч ${minutes}м ${seconds}с`);
            } else if (minutes > 0) {
                setCountdown(`${minutes}м ${seconds}с`);
            } else {
                setCountdown(`${seconds}с`);
            }
        } else {
            setCountdown("Неактивен!");
        }
    };

    const confirmActivity = async () => {
        if (!willInfo) return;

        try {
            setConfirmLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);
            
            const tx = await will.confirmActivity();
            
            toast({
                title: "Транзакция отправлена",
                description: "Подтверждение активности...",
                status: "info",
                duration: 3000
            });

            await tx.wait();
            
            toast({
                title: "✅ Активность подтверждена!",
                description: "Вы успешно подтвердили, что живы и здоровы",
                status: "success",
                duration: 5000
            });

            // Обновляем информацию
            loadWillInfo();

        } catch (error: any) {
            toast({
                title: "Ошибка подтверждения",
                description: error.message,
                status: "error",
                duration: 5000
            });
        } finally {
            setConfirmLoading(false);
        }
    };

    useEffect(() => {
        loadWillInfo();
    }, [willAddress]);

    useEffect(() => {
        if (willInfo) {
            calculateTimeUntilInactive();
            const interval = setInterval(calculateTimeUntilInactive, 1000);
            return () => clearInterval(interval);
        }
    }, [willInfo]);

    if (loading) {
        return (
            <Box textAlign="center" py={10}>
                <Text>Загрузка информации о завещании...</Text>
            </Box>
        );
    }

    if (!willInfo) {
        return (
            <Alert status="error">
                <AlertIcon />
                <AlertTitle>Ошибка!</AlertTitle>
                <AlertDescription>Не удалось загрузить информацию о завещании</AlertDescription>
            </Alert>
        );
    }

    const progressValue = timeUntilInactive > 0 
        ? (timeUntilInactive / Number(willInfo.willActivateWaitingPeriod)) * 100
        : 0;

    return (
        <VStack spacing={6} align="stretch">
            {/* Заголовок */}
            <Card bg={cardBg}>
                <CardHeader>
                    <HStack>
                        <Icon as={FaShieldAlt} color="blue.500" boxSize={6} />
                        <VStack align="start" spacing={0}>
                            <Heading size="lg">Мое завещание</Heading>
                            <Text color={textColor}>
                                Адрес контракта: {willAddress.slice(0, 6)}...{willAddress.slice(-4)}
                            </Text>
                        </VStack>
                    </HStack>
                </CardHeader>
            </Card>

            {/* Статус активности */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaUser} color="green.500" />
                                <Text fontWeight="semibold">Ваш статус</Text>
                            </HStack>
                            <Badge 
                                colorScheme={willInfo.isOwnerActive ? "green" : "red"} 
                                size="lg"
                                px={3}
                                py={1}
                            >
                                {willInfo.isOwnerActive ? "🟢 Активен" : "🔴 Неактивен"}
                            </Badge>
                        </HStack>

                        <Box width="100%">
                            <HStack justify="space-between" mb={2}>
                                <Text fontSize="sm" color={textColor}>Время до неактивности:</Text>
                                <Text fontSize="sm" fontWeight="semibold" color={timeUntilInactive <= 0 ? "red.500" : "green.500"}>
                                    {countdown}
                                </Text>
                            </HStack>
                            <Progress 
                                value={progressValue} 
                                colorScheme={timeUntilInactive <= 0 ? "red" : "green"}
                                size="lg"
                                borderRadius="lg"
                            />
                        </Box>

                        <Text fontSize="sm" color={textColor} textAlign="center">
                            Последняя активность: {new Date(Number(willInfo.lastActivity) * 1000).toLocaleString()}
                        </Text>

                        {!willInfo.isOwnerActive && (
                            <Alert status="error" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>⚠️ Вы неактивны!</AlertTitle>
                                    <AlertDescription>
                                        Наследник может получать выплаты. Подтвердите активность немедленно!
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}

                        {willInfo.isOwnerActive && timeUntilInactive < 3600 && (
                            <Alert status="warning" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>⏰ Скоро станете неактивны!</AlertTitle>
                                    <AlertDescription>
                                        Подтвердите активность в течение {countdown}, иначе наследник сможет получать выплаты.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}
                    </VStack>
                </CardBody>
            </Card>

            {/* Информация о наследнике */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaHeart} color="red.500" />
                                <Text fontWeight="semibold">Наследник</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color={textColor}>Имя:</Text>
                                <Text fontWeight="semibold">{willInfo.heirName}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Роль:</Text>
                                <Text fontWeight="semibold">{willInfo.heirRole}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Адрес:</Text>
                                <Text fontFamily="monospace" fontSize="sm">
                                    {willInfo.heir.slice(0, 6)}...{willInfo.heir.slice(-4)}
                                </Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Параметры выплат */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaEthereum} color="green.500" />
                                <Text fontWeight="semibold">Параметры выплат</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color={textColor}>Сумма выплаты:</Text>
                                <Text fontWeight="semibold">{ethers.formatEther(willInfo.transferAmount)} ETH</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Частота:</Text>
                                <Text fontWeight="semibold">Каждые {Math.floor(Number(willInfo.transferFrequency) / 60)} минут</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Период ожидания:</Text>
                                <Text fontWeight="semibold">{Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} минут</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color={textColor}>Баланс:</Text>
                                <Text fontWeight="semibold" color="green.500">{ethers.formatEther(willInfo.balance)} ETH</Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Кнопка подтверждения активности */}
            <Card bg={cardBg}>
                <CardBody>
                    <VStack spacing={4}>
                        <Button
                            colorScheme="green"
                            size="xl"
                            width="100%"
                            py={6}
                            onClick={confirmActivity}
                            isLoading={confirmLoading}
                            leftIcon={<Icon as={FaCheck} />}
                            fontSize="lg"
                            fontWeight="bold"
                            borderRadius="xl"
                            loadingText="Подтверждение..."
                            _hover={{
                                transform: "translateY(-2px)",
                                boxShadow: "xl"
                            }}
                        >
                            💚 Я жив и здоров!
                        </Button>

                        <Text textAlign="center" color={textColor} fontSize="sm">
                            Регулярно подтверждайте активность, чтобы наследник не мог получить средства
                        </Text>

                        <Alert status="info" borderRadius="lg">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>ℹ️ Как это работает</AlertTitle>
                                <AlertDescription>
                                    Когда вы нажимаете эту кнопку, период ожидания сбрасывается. 
                                    Наследник сможет получать выплаты только если вы не подтверждаете активность 
                                    в течение {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} минут.
                                </AlertDescription>
                            </Box>
                        </Alert>
                    </VStack>
                </CardBody>
            </Card>

            {/* Информация о следующем возможном переводе */}
            {!willInfo.isOwnerActive && (
                <Card bg={cardBg} borderColor="red.500" borderWidth="2px">
                    <CardBody>
                        <VStack spacing={4}>
                            <HStack justify="space-between" width="100%">
                                <HStack>
                                    <Icon as={FaClock} color="red.500" />
                                    <Text fontWeight="semibold" color="red.500">ВНИМАНИЕ!</Text>
                                </HStack>
                            </HStack>

                            <Alert status="error" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>Наследник может получать выплаты!</AlertTitle>
                                    <AlertDescription>
                                        Следующий возможный перевод: {new Date(Number(willInfo.nextPossibleTransferTime) * 1000).toLocaleString()}
                                        <br />
                                        Подтвердите активность, чтобы заблокировать переводы.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        </VStack>
                    </CardBody>
                </Card>
            )}

            {/* Обновление данных */}
            <Box textAlign="center">
                <Button
                    variant="outline"
                    onClick={loadWillInfo}
                    isLoading={loading}
                    leftIcon={<Icon as={FaShieldAlt} />}
                >
                    Обновить данные
                </Button>
            </Box>
        </VStack>
    );
} 