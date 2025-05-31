import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
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

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.800', 'white');
    const borderColor = useColorModeValue('gray.200', 'gray.700');

    // Функция для форматирования времени в секундах в читаемый формат
    const formatTime = (seconds: number): string => {
        if (seconds < 60) {
            return `${seconds} сек`;
        } else if (seconds < 3600) {
            return `${Math.floor(seconds / 60)} мин`;
        } else if (seconds < 86400) {
            return `${Math.floor(seconds / 3600)} ч ${Math.floor((seconds % 3600) / 60)} мин`;
        } else {
            return `${Math.floor(seconds / 86400)} дн ${Math.floor((seconds % 86400) / 3600)} ч`;
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
                return "Доступно сейчас";
            } else {
                const timeToWait = waitingSeconds - timeAfterLastActivity;
                return `Через ${formatTime(timeToWait)} (после активности владельца)`;
            }
        }

        // Если есть nextTransferTime, используем его
        if (nextTime <= currentTime) {
            // Дополнительно проверяем период ожидания после последней активности
            const timeAfterLastActivity = currentTime - lastActivity;
            if (timeAfterLastActivity >= waitingSeconds) {
                return "Доступно сейчас";
            } else {
                const timeToWait = waitingSeconds - timeAfterLastActivity;
                return `Через ${formatTime(timeToWait)} (период ожидания после активности)`;
            }
        }

        // Если nextTime больше текущего времени, показываем время до nextTime
        const timeLeft = nextTime - currentTime;
        return `Через ${formatTime(timeLeft)}`;
    };

    // Получение информации о завещании для наследника
    const fetchHeirWillInfo = async (willAddress: string, userAddress: string): Promise<HeirWillInfo | null> => {
        try {
            console.log(`📋 Анализ завещания для наследника ${willAddress}...`);

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

            return {
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

        } catch (error) {
            console.error(`❌ Ошибка при анализе завещания ${willAddress}:`, error);
            return null;
        }
    };

    // Загрузка завещаний где пользователь является наследником
    const loadHeirWills = async () => {
        try {
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

            console.log("Найдено завещаний для наследника:", validHeirWills.length);
            setHeirWills(validHeirWills);

        } catch (error) {
            console.error("Ошибка при загрузке завещаний наследника:", error);
            toast({
                title: "Ошибка",
                description: "Не удалось загрузить завещания",
                status: "error",
                duration: 5000,
                isClosable: true
            });
        } finally {
            setLoading(false);
            setLoadingProgress({current: 0, total: 0});
        }
    };

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

    // Экспортируем методы через ref
    useImperativeHandle(ref, () => ({
        loadHeirWills,
        refreshWills: () => {
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

    // Загрузка при монтировании компонента
    useEffect(() => {
        if (signer && factoryAddress) {
            loadHeirWills();
        }
    }, [signer, factoryAddress]);

    // Метод для принудительного обновления данных
    const refreshWills = () => {
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
    };

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Заголовок с кнопкой обновления */}
            <Flex justifyContent="space-between" alignItems="center">
                <HStack spacing={3}>
                    <Icon as={FaGift} boxSize={6} color="green.500" />
                    <Heading size="lg" bgGradient="linear(to-r, green.500, green.600)" bgClip="text">
                        Мое наследство
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
                    Обновить
                </Button>
            </Flex>

            {loading ? (
                <Center p={16}>
                    <VStack spacing={6}>
                        <Spinner size="xl" color="green.500" thickness="4px" speed="0.8s" />
                        <VStack spacing={2}>
                            <Text fontSize="lg" color={textColor} fontWeight="medium">
                                Поиск завещаний...
                            </Text>
                            {loadingProgress.total > 0 && (
                                <Text fontSize="sm" color="gray.500">
                                    Проверено {loadingProgress.current} из {loadingProgress.total} завещаний
                                </Text>
                            )}
                        </VStack>
                    </VStack>
                </Center>
            ) : heirWills.length === 0 ? (
                <Box py={16} textAlign="center">
                    <VStack spacing={6}>
                        <Icon as={FaGift} boxSize={16} color="gray.300" />
                        <VStack spacing={2}>
                            <Heading size="md" color={textColor}>
                                Вы не являетесь наследником
                            </Heading>
                            <Text fontSize="lg" color={textColor}>
                                На данный момент для вас нет доступных завещаний
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
                                    <StatLabel color={textColor}>Завещаний</StatLabel>
                                    <StatNumber color="green.500">{heirWills.length}</StatNumber>
                                    <StatHelpText>Где вы наследник</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Доступно к получению</StatLabel>
                                    <StatNumber color="blue.500">
                                        {heirWills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0).toFixed(4)} ETH
                                    </StatNumber>
                                    <StatHelpText>Общая сумма</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Готовы к получению</StatLabel>
                                    <StatNumber color="orange.500">
                                        {heirWills.filter(will => will.canClaim).length}
                                    </StatNumber>
                                    <StatHelpText>Завещаний</StatHelpText>
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
                                                    От: {`${will.ownerAddress.slice(0, 6)}...${will.ownerAddress.slice(-4)}`}
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
                                                Наследство #{index + 1}
                                            </Badge>
                                            {will.canClaim && (
                                                <Badge colorScheme="green" variant="solid" fontSize="xs">
                                                    Готово к получению
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
                                                    Финансы
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize="sm">
                                                    <strong>Доступно:</strong> {will.balance} ETH
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>За раз:</strong> {will.transferAmount} ETH
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Лимит:</strong> {will.limit} ETH
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Временная информация */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaClock} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Настройки времени
                                                </Text>
                                            </HStack>
                                            <VStack align="start" spacing={1}>
                                                <Text fontSize="sm">
                                                    <strong>Частота выплат:</strong>{" "}
                                                    <Badge colorScheme="orange" variant="subtle" borderRadius="md">
                                                        {formatTime(Number(will.transferFrequency))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Период ожидания:</strong>{" "}
                                                    <Badge colorScheme="purple" variant="subtle" borderRadius="md">
                                                        {formatTime(Number(will.waitingPeriod))}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Последняя активность:</strong>{" "}
                                                    <Badge colorScheme="blue" variant="subtle" borderRadius="md">
                                                        {new Date(Number(will.ownerLastActivity) * 1000).toLocaleString()}
                                                    </Badge>
                                                </Text>
                                                <Text fontSize="xs" color={textColor}>
                                                    Следующая возможность: {formatNextClaimTime(will.nextClaimTime, will.ownerLastActivity, will.waitingPeriod)}
                                                </Text>
                                            </VStack>
                                        </VStack>

                                        {/* Действия */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaCoins} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Действия
                                                </Text>
                                            </HStack>
                                            <Button
                                                onClick={() => claimInheritance(will.address)}
                                                isDisabled={!will.canClaim || parseFloat(will.balance) === 0}
                                                isLoading={claimingWill === will.address}
                                                loadingText="Получение..."
                                                colorScheme="green"
                                                size="sm"
                                                leftIcon={<Icon as={FaGift} />}
                                                _hover={{
                                                    transform: will.canClaim ? "translateY(-1px)" : "none",
                                                    boxShadow: will.canClaim ? "md" : "none"
                                                }}
                                            >
                                                Получить средства
                                            </Button>
                                        </VStack>
                                    </SimpleGrid>

                                    <Divider my={4} />

                                    <Box p={3} bg={useColorModeValue('gray.50', 'gray.700')} borderRadius="lg">
                                        <Text fontSize="xs" color={textColor} fontFamily="monospace">
                                            <strong>Адрес контракта:</strong> {will.address}
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
                            Вы можете получать средства только если владелец завещания не проявлял активность в течение установленного периода времени.
                        </AlertDescription>
                    </Alert>
                </>
            )}
        </VStack>
    );
});

export default HeirWills;
