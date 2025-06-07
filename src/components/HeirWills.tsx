import { useState, useEffect, forwardRef, useImperativeHandle, useRef, useCallback, useMemo } from "react";
import { ethers } from "ethers";
import {
    Box,
    Button,
    Text,
    VStack,
    Heading,
    Spinner,
    HStack,
    Flex,
    useToast,
    Divider,
    Center,
    Icon,
    useColorModeValue,
    Badge,
    Card,
    CardBody,
    CardHeader,
    SimpleGrid,
    Stat,
    StatLabel,
    StatNumber,
    StatHelpText,
    Alert,
    AlertIcon,
    AlertDescription
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import { FaUser, FaEthereum, FaClock, FaGift, FaCoins } from "react-icons/fa";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";

interface HeirWillsProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

// Интерфейс для завещаний наследника
export interface HeirWillInfo {
    address: string;
    balance: string;
    ownerAddress: string;
    heirName: string;
    heirRole: string;
    transferAmount: string;
    transferFrequency: string;
    waitingPeriod: string;
    ownerLastActivity: string;
    limit: string;
    canClaim: boolean;
    nextClaimTime: string;
}

const HeirWills = forwardRef(({ signer, factoryAddress }: HeirWillsProps, ref) => {
    const [heirWills, setHeirWills] = useState<HeirWillInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState<{current: number, total: number}>({current: 0, total: 0});
    const [claimingWill, setClaimingWill] = useState<string | null>(null);
    const toast = useToast();

    // Добавляем рефы для предотвращения дублирующихся вызовов
    const loadingRef = useRef(false);
    const cacheRef = useRef<Map<string, HeirWillInfo>>(new Map());
    const lastLoadRef = useRef<number>(0);
    const requestCountRef = useRef<number>(0);

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.800', 'white');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    // Добавляем счетчик запросов для отладки
    useEffect(() => {
        requestCountRef.current = 0;
        console.log("🚀 HeirWills component initialized");

        return () => {
            console.log(`🏁 HeirWills component unmounted. Total requests: ${requestCountRef.current}`);
        };
    }, []);

    // Функция для форматирования времени в секундах в читаемый формат
    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds} sec`;
        } else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)} min`;
        } else if (seconds < 86400) {
            return `${Math.floor(seconds / 3600)} h ${Math.floor((seconds % 3600) / 60)} min`;
        } else {
            return `${Math.floor(seconds / 86400)} d ${Math.floor((seconds % 86400) / 3600)} h`;
        }
    };

    const formatNextClaimTime = (nextTransferTime: string, ownerLastActivity: string, waitingPeriod: string): string => {
        const nextTime = parseInt(nextTransferTime);
        const lastActivity = parseInt(ownerLastActivity);
        const waitingSeconds = parseInt(waitingPeriod);
        const currentTime = Math.floor(Date.now() / 1000);

        // Если nextTransferTime равен 0, то нужно проверить период ожидания после последней активности
        if (nextTime === 0) {
            const timeAfterLastActivity = currentTime - lastActivity;
            if (timeAfterLastActivity >= waitingSeconds) {
                return "Available now";
            } else {
                const timeToWait = waitingSeconds - timeAfterLastActivity;
                return `In ${formatTime(timeToWait)} (after owner activity)`;
            }
        }

        // Если есть nextTransferTime, используем его
        if (nextTime <= currentTime) {
            // Дополнительно проверяем период ожидания после последней активности
            const timeAfterLastActivity = currentTime - lastActivity;
            if (timeAfterLastActivity >= waitingSeconds) {
                return "Available now";
            } else {
                const timeToWait = waitingSeconds - timeAfterLastActivity;
                return `In ${formatTime(timeToWait)} (waiting period after activity)`;
            }
        }

        // Если nextTime больше текущего времени, показываем время до nextTime
        const timeLeft = nextTime - currentTime;
        return `In ${formatTime(timeLeft)}`;
    };

    // Получение информации о завещании для наследника с кешированием
    const fetchHeirWillInfo = useCallback(async (willAddress: string, userAddress: string): Promise<HeirWillInfo | null> => {
        try {
            requestCountRef.current += 1;

            // Проверяем кеш
            const cacheKey = `${willAddress}-${userAddress}`;
            const cached = cacheRef.current.get(cacheKey);
            if (cached) {
                console.log(`📋 Использование кеша для завещания ${willAddress}... (запрос #${requestCountRef.current})`);
                return cached;
            }

            console.log(`📋 Анализ завещания для наследника ${willAddress}... (запрос #${requestCountRef.current})`);

            const willContract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            // Последовательные вызовы с индивидуальной обработкой ошибок
            let balance, heir, heirName, heirRole, transferAmount, transferFrequency;
            let waitingPeriod, ownerLastActivity, limit, ownerAddress, canTransferNow, nextTransferTime;

            try {
                balance = await willContract.getBalance();
            } catch (error) {
                console.error(`Ошибка получения баланса для ${willAddress}:`, error);
                return null;
            }

            try {
                heir = await willContract.heir();
            } catch (error) {
                console.error(`Ошибка получения наследника для ${willAddress}:`, error);
                return null;
            }

            // Проверяем, является ли пользователь наследником
            if (heir.toLowerCase() !== userAddress.toLowerCase()) {
                console.log(`❌ Пользователь не является наследником завещания ${willAddress}`);
                return null;
            }

            try {
                heirName = await willContract.heirName();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить имя наследника для ${willAddress}:`, error);
                heirName = "Не указано";
            }

            try {
                heirRole = await willContract.heirRole();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить роль наследника для ${willAddress}:`, error);
                heirRole = "Не указано";
            }

            try {
                transferAmount = await willContract.transferAmount();
            } catch (error) {
                console.error(`Ошибка получения суммы перевода для ${willAddress}:`, error);
                return null;
            }

            try {
                transferFrequency = await willContract.transferFrequency();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить частоту переводов для ${willAddress}:`, error);
                transferFrequency = BigInt(0);
            }

            try {
                waitingPeriod = await willContract.willActivateWaitingPeriod();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить период ожидания для ${willAddress}:`, error);
                waitingPeriod = BigInt(0);
            }

            try {
                ownerLastActivity = await willContract.getOwnerLastActivity();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить последнюю активность владельца для ${willAddress}:`, error);
                ownerLastActivity = BigInt(0);
            }

            try {
                limit = await willContract.limit();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить лимит для ${willAddress}:`, error);
                limit = BigInt(0);
            }

            try {
                ownerAddress = await willContract.owner();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить адрес владельца для ${willAddress}:`, error);
                ownerAddress = "0x0000000000000000000000000000000000000000";
            }

            try {
                canTransferNow = await willContract.canTransferNow();
            } catch (error) {
                console.warn(`Предупреждение: не удалось проверить возможность перевода для ${willAddress}:`, error);
                canTransferNow = false;
            }

            try {
                nextTransferTime = await willContract.getNextTransferTime();
            } catch (error) {
                console.warn(`Предупреждение: не удалось получить время следующего перевода для ${willAddress}:`, error);
                // Попробуем альтернативный метод
                try {
                    nextTransferTime = await willContract.getNextPossibleTransferTime();
                } catch (altError) {
                    console.warn(`Альтернативный метод тоже недоступен для ${willAddress}:`, altError);
                    nextTransferTime = BigInt(0);
                }
            }

            console.log(`✅ Завещание ${willAddress}: heir=${heir}, user=${userAddress}, canTransfer=${canTransferNow}`);

            // Проверяем, может ли наследник получить средства сейчас
            const hasEnoughBalance = balance >= transferAmount;
            const canClaim = hasEnoughBalance && canTransferNow;

            console.log(`📊 Завещание ${willAddress}: balance=${ethers.formatEther(balance)} ETH, transferAmount=${ethers.formatEther(transferAmount)} ETH, canClaim=${canClaim}`);

            const willInfo: HeirWillInfo = {
                address: willAddress,
                balance: ethers.formatEther(balance),
                ownerAddress,
                heirName,
                heirRole,
                transferAmount: ethers.formatEther(transferAmount),
                transferFrequency: transferFrequency.toString(),
                waitingPeriod: waitingPeriod.toString(),
                ownerLastActivity: ownerLastActivity.toString(),
                limit: ethers.formatEther(limit),
                canClaim,
                nextClaimTime: nextTransferTime.toString()
            };

            // Кешируем результат на 30 секунд
            cacheRef.current.set(cacheKey, willInfo);
            setTimeout(() => {
                cacheRef.current.delete(cacheKey);
            }, 30000);

            return willInfo;

        } catch (error) {
            console.error(`❌ Ошибка при анализе завещания ${willAddress}:`, error);
            return null;
        }
    }, [signer]);

    // Загрузка завещаний где пользователь является наследником с защитой от дублирующихся вызовов
    const loadHeirWills = useCallback(async () => {
        // Предотвращаем дублирующиеся вызовы
        if (loadingRef.current) {
            console.log("⏳ Загрузка уже выполняется, пропускаем...");
            return;
        }

        // Дебаунсинг - не загружаем чаще чем раз в 2 секунды
        const now = Date.now();
        if (now - lastLoadRef.current < 2000) {
            console.log(`⏰ Слишком частые вызовы (${now - lastLoadRef.current}ms назад), пропускаем...`);
            return;
        }

        try {
            console.log("🚀 Начало загрузки завещаний для наследника...");
            loadingRef.current = true;
            lastLoadRef.current = now;
            setLoading(true);
            setLoadingProgress({current: 0, total: 0});

            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const userAddress = await signer.getAddress();

            // Получаем все развернутые завещания
            let willsList = [];
            try {
                willsList = await factory.getDeployedWills();
            } catch (error) {
                console.log("Ошибка при вызове getDeployedWills, пробуем альтернативный метод:", error);

                let index = 0;
                let continueLoop = true;

                while (continueLoop) {
                    try {
                        const willAddress = await factory.deployedWills(index);
                        willsList.push(willAddress);
                        index++;
                    } catch (error) {
                        console.log(`Достигнут конец списка завещаний на индексе ${index}`);
                        continueLoop = false;
                    }
                }
            }

            console.log("Проверяем завещания для наследника:", willsList.length);
            setLoadingProgress({current: 0, total: willsList.length});

            if (willsList.length === 0) {
                setHeirWills([]);
                return;
            }

            // Последовательно проверяем каждое завещание чтобы избежать RPC перегрузки
            const validHeirWills: HeirWillInfo[] = [];

            for (let i = 0; i < willsList.length; i++) {
                const address = willsList[i];
                setLoadingProgress({current: i + 1, total: willsList.length});

                try {
                    const willInfo = await fetchHeirWillInfo(address, userAddress);
                    if (willInfo) {
                        validHeirWills.push(willInfo);
                    }
                } catch (error) {
                    console.warn(`Пропускаем завещание ${address} из-за ошибки:`, error);
                    continue;
                }

                // Небольшая пауза между запросами чтобы не перегружать RPC
                await new Promise(resolve => setTimeout(resolve, 100));
            }

            console.log(`✅ Найдено ${validHeirWills.length} завещаний для наследника`);
            setHeirWills(validHeirWills);

        } catch (error) {
            console.error("❌ Ошибка при загрузке завещаний для наследника:", error);
            toast({
                title: "Ошибка загрузки",
                description: "Не удалось загрузить данные о наследстве",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [signer, factoryAddress, fetchHeirWillInfo, toast]);

    // Метод для получения средств из завещания
    const claimInheritance = async (willAddress: string) => {
        try {
            setClaimingWill(willAddress);
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            // Вызываем функцию получения средств
            const tx = await contract.transferToHeir();

            toast({
                title: "Транзакция отправлена",
                description: "Ожидание подтверждения...",
                status: "info",
                duration: 3000,
                isClosable: true
            });

            // Ждем подтверждения транзакции
            await tx.wait();

            toast({
                title: "Успешно!",
                description: "Средства переведены на ваш кошелек",
                status: "success",
                duration: 5000,
                isClosable: true
            });

            // Обновляем информацию о завещаниях
            loadHeirWills();

        } catch (error) {
            console.error("Ошибка при получении наследства:", error);
            toast({
                title: "Ошибка",
                description: "Не удалось получить средства. Проверьте условия завещания.",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setClaimingWill(null);
        }
    };

    // Добавляем imperativeHandle для внешнего управления
    useImperativeHandle(ref, () => ({
        refreshWills: () => {
            // Очищаем кеш при принудительном обновлении
            cacheRef.current.clear();
            if (signer) {
                loadHeirWills();
                toast({
                    title: "Обновление данных",
                    description: "Загрузка данных о наследстве...",
                    status: "info",
                    duration: 2000,
                    isClosable: true
                });
            }
        }
    }));

    // Загрузка при монтировании компонента с оптимизацией
    useEffect(() => {
        if (signer && factoryAddress) {
            loadHeirWills();
        }
    }, [loadHeirWills]); // Изменяем зависимость на мемоизированную функцию

    // Метод для принудительного обновления данных
    const refreshWills = useCallback(() => {
        // Очищаем кеш при принудительном обновлении
        cacheRef.current.clear();
        if (signer) {
            loadHeirWills();
            toast({
                title: "Обновление данных",
                description: "Загрузка данных о наследстве...",
                status: "info",
                duration: 2000,
                isClosable: true
            });
        }
    }, [signer, loadHeirWills, toast]);

    // Мемоизированные статистические данные
    const statistics = useMemo(() => {
        const totalBalance = heirWills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0);
        const claimableWills = heirWills.filter(will => will.canClaim).length;

        return {
            totalWills: heirWills.length,
            totalBalance: totalBalance.toFixed(4),
            claimableWills
        };
    }, [heirWills]);

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Заголовок с кнопкой обновления */}
            <Flex justifyContent="space-between" alignItems="center">
                <HStack spacing={3}>
                    <Icon as={FaGift} boxSize={6} color="green.500" />
                    <Heading size="lg" bgGradient="linear(to-r, green.500, green.600)" bgClip="text">
                        My inheritance
                    </Heading>
                </HStack>
                <Button
                    size="md"
                    onClick={refreshWills}
                    leftIcon={<Icon as={RepeatIcon} />}
                    isLoading={loading}
                    colorScheme="green"
                    variant="outline"
                    borderRadius="lg"
                    _hover={{
                        bg: "transparent",
                        transform: "translateY(-1px)",
                        bgGradient: "linear(to-r, green.500, green.600)",
                        color: "white",
                        borderColor: "transparent"
                    }}
                    transition="all 0.2s"
                >
                    Refresh
                </Button>
            </Flex>

            {loading ? (
                <Center p={16}>
                    <VStack spacing={6}>
                        <Spinner size="xl" color="green.500" thickness="4px" speed="0.8s" />
                        <VStack spacing={2}>
                            <Text fontSize="lg" color={textColor} fontWeight="medium">
                                Searching for wills...
                            </Text>
                            {loadingProgress.total > 0 && (
                                <Text fontSize="sm" color="gray.500">
                                    Checked {loadingProgress.current} of {loadingProgress.total} wills
                                </Text>
                            )}
                            <Text fontSize="xs" color="gray.400">
                                Requests completed: {requestCountRef.current}
                            </Text>
                        </VStack>
                    </VStack>
                </Center>
            ) : heirWills.length === 0 ? (
                <Box py={16} textAlign="center">
                    <VStack spacing={6}>
                        <Icon as={FaGift} boxSize={16} color="gray.300" />
                        <VStack spacing={2}>
                            <Heading size="md" color={textColor}>
                                You are not an heir
                            </Heading>
                            <Text fontSize="lg" color={textColor}>
                                At the moment, there are no available wills for you
                            </Text>
                        </VStack>
                    </VStack>
                </Box>
            ) : (
                <>
                    {/* Статистика */}
                    <SimpleGrid columns={{ base: 1, md: 3 }} spacing={6}>
                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Wills</StatLabel>
                                    <StatNumber color="green.500">{statistics.totalWills}</StatNumber>
                                    <StatHelpText>Where you are an heir</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Available to receive</StatLabel>
                                    <StatNumber color="blue.500">
                                        {statistics.totalBalance} ETH
                                    </StatNumber>
                                    <StatHelpText>Total amount</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Ready to receive</StatLabel>
                                    <StatNumber color="orange.500">
                                        {statistics.claimableWills}
                                    </StatNumber>
                                    <StatHelpText>Wills</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                    </SimpleGrid>

                    {/* Список завещаний */}
                    <VStack spacing={6} align="stretch">
                        {heirWills.map((will, index) => (
                            <Card
                                key={will.address}
                                bg={cardBg}
                                borderRadius="xl"
                                boxShadow="lg"
                                border="1px solid"
                                borderColor={will.canClaim ? "green.200" : borderColor}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                _hover={{
                                    transform: "translateY(-2px)",
                                    boxShadow: "xl",
                                    borderColor: will.canClaim ? "green.400" : "#081781"
                                }}
                            >
                                <CardHeader pb={2}>
                                    <HStack justify="space-between">
                                        <HStack spacing={3}>
                                            <Icon as={FaUser} color="blue.500" boxSize={5} />
                                            <VStack align="start" spacing={0}>
                                                <Heading size="md" color="#081781">
                                                    {will.heirName} ({will.heirRole})
                                                </Heading>
                                                <Text fontSize="sm" color={textColor}>
                                                    From: {`${will.ownerAddress.slice(0, 6)}...${will.ownerAddress.slice(-4)}`}
                                                </Text>
                                            </VStack>
                                        </HStack>
                                        <VStack spacing={2} align="end">
                                            <Badge
                                                colorScheme={will.canClaim ? "green" : "orange"}
                                                variant="outline"
                                                fontSize="sm"
                                                px={3}
                                                py={1}
                                            >
                                                Will #{index + 1}
                                            </Badge>
                                            {will.canClaim && (
                                                <Badge colorScheme="green" variant="solid" fontSize="xs">
                                                    Ready to receive
                                                </Badge>
                                            )}
                                        </VStack>
                                    </HStack>
                                </CardHeader>

                                <CardBody pt={2}>
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                                        {/* Финансовая информация */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaEthereum} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Funds
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize="sm">
                                                    <strong>Available:</strong> {will.balance} ETH
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Per transfer:</strong> {will.transferAmount} ETH
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Временная информация */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaClock} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Time settings
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize="sm">
                                                    <strong>Transfer frequency:</strong>{" "}
                                                    <Badge colorScheme="orange" variant="subtle" borderRadius="md">
                                                        {formatTime(Number(will.transferFrequency))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Waiting period:</strong>{" "}
                                                    <Badge colorScheme="purple" variant="subtle" borderRadius="md">
                                                        {formatTime(Number(will.waitingPeriod))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Last activity:</strong>{" "}
                                                    <Badge colorScheme="blue" variant="subtle" borderRadius="md">
                                                        {new Date(Number(will.ownerLastActivity) * 1000).toLocaleString()}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="xs" color={textColor}>
                                                    Next opportunity: {formatNextClaimTime(will.nextClaimTime, will.ownerLastActivity, will.waitingPeriod)}
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Действия */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaCoins} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Actions
                                                </Text>
                                            </HStack>
                                            <Button
                                                onClick={() => claimInheritance(will.address)}
                                                isDisabled={!will.canClaim || parseFloat(will.balance) === 0}
                                                isLoading={claimingWill === will.address}
                                                loadingText="Receiving..."
                                                colorScheme="green"
                                                size="sm"
                                                leftIcon={<Icon as={FaGift} />}
                                                _hover={{
                                                    transform: will.canClaim ? "translateY(-1px)" : "none",
                                                    boxShadow: will.canClaim ? "md" : "none"
                                                }}
                                            >
                                                Receive funds
                                            </Button>
                                        </VStack>
                                    </SimpleGrid>

                                    <Divider my={4} />

                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg">
                                        <Text fontSize="xs" color={textColor} fontFamily="monospace">
                                            <strong>Contract address:</strong> {will.address}
                                        </Text>
                                    </Box>
                                </CardBody>
                            </Card>
                        ))}
                    </VStack>

                    {/* Информационное сообщение */}
                    <Alert status="info" borderRadius="xl" variant="subtle">
                        <AlertIcon />
                        <AlertDescription>
                            You can receive funds only if the will owner did not show activity during the established period of time.
                        </AlertDescription>
                    </Alert>
                </>
            )}
        </VStack>
    );
});

export default HeirWills;
