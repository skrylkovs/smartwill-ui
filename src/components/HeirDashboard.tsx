import { useState, useEffect } from "react";
import {
    Box,
    Card,
    CardBody,
    CardHeader,
    Heading,
    Text,
    Badge,
    Button,
    VStack,
    HStack,
    Progress,
    Alert,
    AlertIcon,
    AlertTitle,
    AlertDescription,
    Divider,
    useToast,
    Icon
} from "@chakra-ui/react";
import { FaHeart, FaClock, FaEthereum, FaUser, FaShieldAlt, FaCheckCircle } from "react-icons/fa";
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
    canTransferNow: boolean;
}

export default function HeirDashboard({ signer, willAddress }: Props) {
    const [willInfo, setWillInfo] = useState<WillInfo | null>(null);
    const [loading, setLoading] = useState(false);
    const [transferLoading, setTransferLoading] = useState(false);
    const [countdown, setCountdown] = useState<string>("");
    const [ownerActivityCountdown, setOwnerActivityCountdown] = useState<string>("");

    const toast = useToast();

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
                nextPossibleTransferTime,
                canTransferNow
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
                will.getNextPossibleTransferTime(),
                will.canTransferNow()
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
                nextPossibleTransferTime,
                canTransferNow
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

    const calculateCountdowns = () => {
        if (!willInfo) return;

        const currentTime = Math.floor(Date.now() / 1000);
        
        // Время до следующего возможного перевода
        const timeUntilTransfer = Number(willInfo.nextPossibleTransferTime) - currentTime;
        
        // Время до неактивности владельца
        const timeUntilOwnerInactive = Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod) - currentTime;

        if (timeUntilTransfer > 0) {
            const hours = Math.floor(timeUntilTransfer / 3600);
            const minutes = Math.floor((timeUntilTransfer % 3600) / 60);
            const seconds = timeUntilTransfer % 60;
            
            if (hours > 0) {
                setCountdown(`${hours}ч ${minutes}м ${seconds}с`);
            } else if (minutes > 0) {
                setCountdown(`${minutes}м ${seconds}с`);
            } else {
                setCountdown(`${seconds}с`);
            }
        } else {
            setCountdown("Доступно!");
        }

        if (willInfo.isOwnerActive && timeUntilOwnerInactive > 0) {
            const hours = Math.floor(timeUntilOwnerInactive / 3600);
            const minutes = Math.floor((timeUntilOwnerInactive % 3600) / 60);
            const seconds = timeUntilOwnerInactive % 60;
            
            if (hours > 0) {
                setOwnerActivityCountdown(`${hours}ч ${minutes}м ${seconds}с`);
            } else if (minutes > 0) {
                setOwnerActivityCountdown(`${minutes}м ${seconds}с`);
            } else {
                setOwnerActivityCountdown(`${seconds}с`);
            }
        } else {
            setOwnerActivityCountdown("Неактивен");
        }
    };

    const executeTransfer = async () => {
        if (!willInfo) return;

        try {
            setTransferLoading(true);
            const will = new ethers.Contract(willAddress, smartWillAbi.abi, signer);
            
            const tx = await will.transferToHeir();
            
            toast({
                title: "Транзакция отправлена",
                description: "Выполняется перевод средств...",
                status: "info",
                duration: 3000
            });

            await tx.wait();
            
            toast({
                title: "✅ Средства получены!",
                description: `Вы получили ${ethers.formatEther(willInfo.transferAmount)} ETH`,
                status: "success",
                duration: 5000
            });

            // Обновляем информацию
            loadWillInfo();

        } catch (error: any) {
            let errorMessage = error.message;
            
            if (error.message.includes("Owner is still active")) {
                errorMessage = "Владелец все еще активен. Дождитесь окончания периода ожидания.";
            } else if (error.message.includes("Transfer frequency limit")) {
                errorMessage = "Не прошло достаточно времени с последнего перевода.";
            } else if (error.message.includes("Not enough balance")) {
                errorMessage = "Недостаточно средств в завещании.";
            }
            
            toast({
                title: "Ошибка перевода",
                description: errorMessage,
                status: "error",
                duration: 5000
            });
        } finally {
            setTransferLoading(false);
        }
    };

    useEffect(() => {
        loadWillInfo();
    }, [willAddress]);

    useEffect(() => {
        if (willInfo) {
            calculateCountdowns();
            const interval = setInterval(calculateCountdowns, 1000);
            return () => clearInterval(interval);
        }
    }, [willInfo]);

    if (loading) {
        return (
            <Box textAlign="center" py={10}>
                <Text>Загрузка информации о наследстве...</Text>
            </Box>
        );
    }

    if (!willInfo) {
        return (
            <Alert status="error">
                <AlertIcon />
                <AlertTitle>Ошибка!</AlertTitle>
                <AlertDescription>Не удалось загрузить информацию о наследстве</AlertDescription>
            </Alert>
        );
    }

    const progressValue = willInfo.isOwnerActive 
        ? ((Number(willInfo.lastActivity) + Number(willInfo.willActivateWaitingPeriod) - Math.floor(Date.now() / 1000)) / Number(willInfo.willActivateWaitingPeriod)) * 100
        : 0;

    return (
        <VStack spacing={6} align="stretch">
            {/* Заголовок */}
            <Card bg="white">
                <CardHeader>
                    <HStack>
                        <Icon as={FaHeart} color="red.500" boxSize={6} />
                        <VStack align="start" spacing={0}>
                            <Heading size="lg">Мое наследство</Heading>
                            <Text>
                                Завещание: {willAddress.slice(0, 6)}...{willAddress.slice(-4)}
                            </Text>
                        </VStack>
                    </HStack>
                </CardHeader>
            </Card>

            {/* Статус владельца */}
            <Card bg="white">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaUser} color={willInfo.isOwnerActive ? "green.500" : "red.500"} />
                                <Text fontWeight="semibold">Статус владельца</Text>
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

                        {willInfo.isOwnerActive && (
                            <Box width="100%">
                                <HStack justify="space-between" mb={2}>
                                    <Text fontSize="sm" color="gray.600">Активность владельца истекает через:</Text>
                                    <Text fontSize="sm" fontWeight="semibold" color="green.500">
                                        {ownerActivityCountdown}
                                    </Text>
                                </HStack>
                                <Progress 
                                    value={progressValue} 
                                    colorScheme="green"
                                    size="lg"
                                    borderRadius="lg"
                                />
                                <Text fontSize="xs" color="gray.600" mt={1} textAlign="center">
                                    Последняя активность: {new Date(Number(willInfo.lastActivity) * 1000).toLocaleString()}
                                </Text>
                            </Box>
                        )}

                        {willInfo.isOwnerActive && (
                            <Alert status="info" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>ℹ️ Владелец активен</AlertTitle>
                                    <AlertDescription>
                                        Вы сможете получать выплаты только когда владелец станет неактивным. 
                                        Это произойдет через {ownerActivityCountdown}, если он не подтвердит свою активность.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}

                        {!willInfo.isOwnerActive && (
                            <Alert status="success" borderRadius="lg">
                                <AlertIcon />
                                <Box>
                                    <AlertTitle>✅ Владелец неактивен!</AlertTitle>
                                    <AlertDescription>
                                        Владелец не подтверждал активность более {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} минут. 
                                        Вы можете получать периодические выплаты.
                                    </AlertDescription>
                                </Box>
                            </Alert>
                        )}
                    </VStack>
                </CardBody>
            </Card>

            {/* Информация о завещании */}
            <Card bg="white">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={FaEthereum} color="blue.500" />
                                <Text fontWeight="semibold">Информация о завещании</Text>
                            </HStack>
                        </HStack>

                        <VStack spacing={2} align="stretch">
                            <HStack justify="space-between">
                                <Text color="gray.600">Ваше имя:</Text>
                                <Text fontWeight="semibold">{willInfo.heirName}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Ваша роль:</Text>
                                <Text fontWeight="semibold">{willInfo.heirRole}</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Сумма выплаты:</Text>
                                <Text fontWeight="semibold" color="green.500">{ethers.formatEther(willInfo.transferAmount)} ETH</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Частота выплат:</Text>
                                <Text fontWeight="semibold">Каждые {Math.floor(Number(willInfo.transferFrequency) / 60)} минут</Text>
                            </HStack>
                            <HStack justify="space-between">
                                <Text color="gray.600">Баланс завещания:</Text>
                                <Text fontWeight="semibold" color="blue.500">{ethers.formatEther(willInfo.balance)} ETH</Text>
                            </HStack>
                        </VStack>
                    </VStack>
                </CardBody>
            </Card>

            {/* Статус получения средств */}
            <Card bg={willInfo.canTransferNow ? "green.500" : "yellow.500"} borderWidth="2px">
                <CardBody>
                    <VStack spacing={4}>
                        <HStack justify="space-between" width="100%">
                            <HStack>
                                <Icon as={willInfo.canTransferNow ? FaCheckCircle : FaClock} color={willInfo.canTransferNow ? "green.500" : "yellow.500"} />
                                <Text fontWeight="semibold">Получение средств</Text>
                            </HStack>
                            <Badge 
                                colorScheme={willInfo.canTransferNow ? "green" : "yellow"} 
                                size="lg"
                                px={3}
                                py={1}
                            >
                                {willInfo.canTransferNow ? "✅ Доступно" : "⏳ Ожидание"}
                            </Badge>
                        </HStack>

                        {!willInfo.canTransferNow && (
                            <Box width="100%">
                                <Text fontSize="sm" color="gray.600" mb={2} textAlign="center">
                                    Следующий перевод будет доступен через:
                                </Text>
                                <Text fontSize="2xl" fontWeight="bold" textAlign="center" color="yellow.500">
                                    {countdown}
                                </Text>
                                <Text fontSize="sm" color="gray.600" mt={2} textAlign="center">
                                    Время перевода: {new Date(Number(willInfo.nextPossibleTransferTime) * 1000).toLocaleString()}
                                </Text>
                            </Box>
                        )}

                        {willInfo.canTransferNow && (
                            <Box width="100%">
                                <Text fontSize="lg" fontWeight="bold" textAlign="center" color="green.500" mb={4}>
                                    🎉 Вы можете получить средства!
                                </Text>
                                
                                <Button
                                    colorScheme="green"
                                    size="xl"
                                    width="100%"
                                    py={6}
                                    onClick={executeTransfer}
                                    isLoading={transferLoading}
                                    leftIcon={<Icon as={FaEthereum} />}
                                    fontSize="lg"
                                    fontWeight="bold"
                                    borderRadius="xl"
                                    loadingText="Перевод..."
                                    _hover={{
                                        transform: "translateY(-2px)",
                                        boxShadow: "xl"
                                    }}
                                    isDisabled={Number(willInfo.balance) < Number(willInfo.transferAmount)}
                                >
                                    💰 Получить {ethers.formatEther(willInfo.transferAmount)} ETH
                                </Button>

                                {Number(willInfo.balance) < Number(willInfo.transferAmount) && (
                                    <Alert status="warning" borderRadius="lg" mt={4}>
                                        <AlertIcon />
                                        <AlertDescription>
                                            Недостаточно средств в завещании для перевода
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </Box>
                        )}

                        <Divider />

                        <Alert status="info" borderRadius="lg">
                            <AlertIcon />
                            <Box>
                                <AlertTitle>ℹ️ Как работает система</AlertTitle>
                                <AlertDescription fontSize="sm">
                                    <VStack align="start" spacing={1}>
                                        <Text>• Владелец должен регулярно подтверждать активность</Text>
                                        <Text>• Если он не делает этого {Math.floor(Number(willInfo.willActivateWaitingPeriod) / 60)} минут - становится неактивным</Text>
                                        <Text>• После того как владелец становится неактивным, вы можете получать выплаты</Text>
                                        <Text>• Выплаты доступны каждые {Math.floor(Number(willInfo.transferFrequency) / 60)} минут</Text>
                                        <Text>• Если владелец снова подтвердит активность - вам придется ждать новый период</Text>
                                    </VStack>
                                </AlertDescription>
                            </Box>
                        </Alert>
                    </VStack>
                </CardBody>
            </Card>

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