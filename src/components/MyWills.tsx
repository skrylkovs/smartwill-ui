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
import { FaWallet, FaUser, FaEthereum, FaClock, FaHeartbeat, FaFileContract } from "react-icons/fa";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";
import DiagnosticInfo from "./DiagnosticInfo";

interface MyWillsProps {
    signer: ethers.Signer;
    factoryAddress: string;
}

// Экспортируем тип для использования в других компонентах
export interface WillInfo {
    address: string;
    balance: string;
    heir: string;
    heirName: string;
    heirRole: string;
    transferAmount: string;
    transferFrequency: string;
    waitingPeriod: string;
    limit: string;
}

// Изменяем на forwardRef и экспортируем методы через useImperativeHandle
const MyWills = forwardRef(({ signer, factoryAddress }: MyWillsProps, ref) => {
    const [wills, setWills] = useState<WillInfo[]>([]);
    const [lastPing, setLastPing] = useState<string>("Загрузка...");
    const [loading, setLoading] = useState(false);
    const [pingLoading, setPingLoading] = useState(false);
    const toast = useToast();

    const cardBg = useColorModeValue('white', 'gray.800');
    const textColor = useColorModeValue('gray.600', 'gray.300');
    const borderColor = useColorModeValue('gray.200', 'gray.600');

    // Функция для форматирования времени в секундах в читаемый формат
    const formatTime = (seconds: number): string => {
        if (seconds < 60) return `${seconds} сек.`;
        if (seconds < 3600) {
            const minutes = Math.floor(seconds / 60);
            return `${minutes} мин.`;
        }
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        if (minutes === 0) return `${hours} ч.`;
        return `${hours} ч. ${minutes} мин.`;
    };

    // Получение информации о завещании
    const fetchWillInfo = async (willAddress: string, retryCount = 3, delayMs = 1000) => {
        try {
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);

            // Получаем основную информацию из контракта завещания
            const [balance, heir, heirName, heirRole, transferAmount, transferFrequency, waitingPeriod, limit] = await Promise.all([
                contract.getBalance(),
                contract.heir(),
                contract.heirName(),
                contract.heirRole(),
                contract.transferAmount(),
                contract.transferFrequency(),
                contract.willActivateWaitingPeriod(),
                contract.limit()
            ]);

            return {
                address: willAddress,
                balance: ethers.formatEther(balance),
                heir,
                heirName,
                heirRole,
                transferAmount: ethers.formatEther(transferAmount),
                transferFrequency: transferFrequency.toString(),
                waitingPeriod: waitingPeriod.toString(),
                limit: ethers.formatEther(limit)
            };
        } catch (error) {
            console.error(`Ошибка при получении информации о завещании ${willAddress}:`, error);

            // Если у нас остались попытки, ждем и пробуем снова
            if (retryCount > 0) {
                console.log(`Повторная попытка (осталось ${retryCount}) для контракта ${willAddress} через ${delayMs}мс...`);

                // Ожидаем указанное время
                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Рекурсивно вызываем функцию с уменьшенным счетчиком попыток
                return fetchWillInfo(willAddress, retryCount - 1, delayMs * 1.5);
            }

            // Возвращаем базовую информацию, когда закончились попытки
            return {
                address: willAddress,
                balance: "Загрузка...",
                heir: "Загрузка...",
                heirName: "Загрузка...",
                heirRole: "Загрузка...",
                transferAmount: "Загрузка...",
                transferFrequency: "Загрузка...",
                waitingPeriod: "Загрузка...",
                limit: "Загрузка..."
            };
        }
    };

    // Получение последнего пинга из фабрики
    const fetchLastPing = async () => {
        try {
            if (!signer) return;

            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const signerAddress = await signer.getAddress();

            // Пробуем получить последний пинг разными способами
            try {
                // Сначала пробуем вызвать getLastPing()
                try {
                    const lastPingTimestamp = await factory.getLastPing();

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Не удалось получить lastPing через getLastPing():", error);
                }

                // Затем пробуем получить через отображение lastPings
                try {
                    const lastPingTimestamp = await factory.lastPings(signerAddress);

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Не удалось получить lastPing через lastPings:", error);
                }

                // Пробуем через getLastPingOf, если он реализован
                try {
                    const lastPingTimestamp = await factory.getLastPingOf(signerAddress);

                    if (lastPingTimestamp > 0) {
                        setLastPing(new Date(Number(lastPingTimestamp) * 1000).toLocaleString());
                        return;
                    }
                } catch (error) {
                    console.error("Не удалось получить lastPing через getLastPingOf:", error);
                }

                setLastPing("Нет данных о последнем пинге");
            } catch (error) {
                console.error("Все методы получения lastPing не сработали:", error);
                setLastPing("Ошибка получения данных");
            }
        } catch (error) {
            console.error("Ошибка при получении информации о последнем пинге:", error);
            setLastPing("Ошибка получения данных");
        }
    };

    // Отправляет пинг в фабрику
    const handlePingAll = async () => {
        try {
            // Сначала проверяем сеть
            const provider = signer.provider as ethers.BrowserProvider;
            const network = await provider.getNetwork();
            const chainId = Number(network.chainId);

            // ID сети Arbitrum Sepolia: 421614
            if (chainId !== 421614) {
                throw new Error("Пожалуйста, переключитесь на сеть Arbitrum Sepolia в вашем кошельке");
            }

            setPingLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);

            console.log("📤 Отправка ping...");

            // Отправляем один пинг в фабрику
            const pingTx = await factory.ping();
            console.log("⏳ Ожидаем подтверждения транзакции ping...");

            // Ожидаем подтверждения транзакции
            await pingTx.wait();
            console.log("✅ Транзакция ping подтверждена:", pingTx.hash);

            // Добавляем задержку для обновления состояния в блокчейне
            console.log("⏳ Ожидаем обновления состояния в блокчейне...");
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Обновляем информацию о последнем пинге несколько раз для надежности
            let pingUpdated = false;
            for (let attempt = 1; attempt <= 3; attempt++) {
                console.log(`🔄 Попытка ${attempt} обновления информации о ping...`);
                await fetchLastPing();

                // Проверяем, обновилось ли время (примерно должно быть в пределах последних 5 минут)
                const currentTime = new Date();
                const fiveMinutesAgo = new Date(currentTime.getTime() - 5 * 60 * 1000);

                // Если lastPing содержит "Нет данных" или "Ошибка", пробуем еще раз
                if (!lastPing.includes("Нет данных") && !lastPing.includes("Ошибка")) {
                    try {
                        const lastPingDate = new Date(lastPing);
                        if (lastPingDate > fiveMinutesAgo) {
                            console.log("✅ Время ping успешно обновлено");
                            pingUpdated = true;
                            break;
                        }
                    } catch (dateError) {
                        console.log("⚠️ Ошибка парсинга даты, пробуем снова...");
                    }
                }

                if (attempt < 3) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }
            }

            if (!pingUpdated) {
                console.log("⚠️ Время ping может быть не полностью обновлено, но операция выполнена");
            }

            toast({
                title: "Успешно!",
                description: `Вы подтвердили, что живы. Время обновлено.`,
                status: "success",
                duration: 5000,
                isClosable: true,
            });

        } catch (error) {
            console.error("Ошибка при отправке пинга:", error);
            toast({
                title: "Ошибка",
                description: "Не удалось подтвердить, что вы живы. Проверьте консоль для деталей.",
                status: "error",
                duration: 5000,
                isClosable: true,
            });
        } finally {
            setPingLoading(false);
        }
    };

    // Метод для загрузки завещаний
    const loadWills = async () => {
        try {
            setLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            const userAddress = await signer.getAddress();

            console.log("🔍 Диагностика загрузки завещаний:");
            console.log("👤 Адрес пользователя:", userAddress);
            console.log("🏭 Адрес фабрики:", factoryAddress);

            // Получаем только завещания текущего пользователя (безопасно)
            let willsList = [];
            try {
                // Используем безопасный метод getMyWills()
                willsList = await factory.getMyWills();
                console.log("✅ Найдено завещаний текущего пользователя:", willsList.length);
                console.log("📄 Адреса завещаний:", willsList);
            } catch (error) {
                console.error("❌ Ошибка при вызове getMyWills:", error);
                // Если новый метод недоступен, возвращаем пустой массив
                willsList = [];
            }

            // Дополнительная диагностика: проверяем общее количество завещаний
            try {
                const allWills = await factory.getDeployedWills();
                console.log("📊 Всего завещаний в фабрике:", allWills.length);
                console.log("🔗 Адреса всех завещаний:", allWills);

                // Проверяем mapping для текущего пользователя
                try {
                    const userWillsFromMapping = await factory.ownerToWills(userAddress, 0);
                    console.log("🗂️ Первое завещание из mapping:", userWillsFromMapping);
                } catch (mappingError) {
                    console.log("📝 Mapping пуст для пользователя (это нормально, если завещаний нет)");
                }
            } catch (debugError) {
                console.error("⚠️ Ошибка при получении отладочной информации:", debugError);
            }

            // Если список завещаний пуст, завершаем работу
            if (willsList.length === 0) {
                console.log("❌ Завещания не найдены для текущего пользователя");
                setWills([]);
                return;
            }

            // Добавляем небольшую задержку перед запросом информации о завещаниях,
            // чтобы дать блокчейну время на обработку транзакций
            await new Promise(resolve => setTimeout(resolve, 1000));

            // Получаем информацию о каждом завещании
            const willsInfo = await Promise.all(
                willsList.map((address: string) => fetchWillInfo(address))
            );

            // Теперь отображаем только завещания текущего пользователя
            const validWills = willsInfo.filter(Boolean) as WillInfo[];
            console.log("✅ Валидных завещаний пользователя:", validWills.length);

            setWills(validWills);

            // Получаем информацию о последнем пинге
            await fetchLastPing();

            // Дополнительное обновление через секунду для надежности
            setTimeout(async () => {
                await fetchLastPing();
            }, 1000);
        } catch (error) {
            console.error("💥 Общая ошибка при загрузке завещаний:", error);
        } finally {
            setLoading(false);
        }
    };

    // Экспортируем методы через ref
    useImperativeHandle(ref, () => ({
        loadWills,
        refreshWills: () => {
            if (signer) {
                loadWills();
                toast({
                    title: "Обновление данных",
                    description: "Загрузка последних данных о завещаниях...",
                    status: "info",
                    duration: 2000,
                    isClosable: true
                });
            }
        }
    }));

    // Хук загрузки при монтировании
    useEffect(() => {
        if (signer) {
            loadWills();
        }
    }, [signer]);

    // Метод для принудительного обновления данных
    const refreshWills = () => {
        if (signer) {
            loadWills();
            toast({
                title: "Обновление данных",
                description: "Загрузка последних данных о завещаниях...",
                status: "info",
                duration: 2000,
                isClosable: true
            });
        }
    };

    return (
        <VStack spacing={8} align="stretch" w="100%">
            {/* Диагностическая информация */}
            <DiagnosticInfo signer={signer} factoryAddress={factoryAddress} />

            {/* Заголовок с кнопкой обновления */}
            <Flex justifyContent="space-between" alignItems="center">
                <HStack spacing={3}>
                    <Icon as={FaFileContract} boxSize={6} color="#081781" />
                    <Heading size="lg" bgGradient="linear(to-r, #081781, #061264)" bgClip="text">
                        Мои завещания
                    </Heading>
                </HStack>
                <Button
                    size="md"
                    onClick={refreshWills}
                    leftIcon={<Icon as={RepeatIcon} />}
                    isLoading={loading}
                    colorScheme="purple"
                    variant="outline"
                    borderRadius="lg"
                    borderColor="#081781"
                    color="#081781"
                    _hover={{
                        bg: "transparent",
                        transform: "translateY(-1px)",
                        bgGradient: "linear(to-r, #081781, #061264)",
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
                        <Spinner size="xl" color="#081781" thickness="4px" speed="0.8s" />
                        <Text fontSize="lg" color={textColor} fontWeight="medium">
                            Загрузка завещаний...
                        </Text>
                    </VStack>
                </Center>
            ) : wills.length === 0 ? (
                <Box py={16} textAlign="center">
                    <VStack spacing={6}>
                        <Icon as={FaFileContract} boxSize={16} color="gray.300" />
                        <VStack spacing={2}>
                            <Heading size="md" color={textColor}>
                                У вас пока нет завещаний
                            </Heading>
                            <Text fontSize="lg" color={textColor}>
                                Создайте новое завещание, чтобы начать управлять своими активами
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
                                    <StatLabel color={textColor}>Всего завещаний</StatLabel>
                                    <StatNumber color="#081781">{wills.length}</StatNumber>
                                    <StatHelpText>Активных контрактов</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Общий баланс</StatLabel>
                                    <StatNumber color="green.500">
                                        {wills.reduce((sum, will) => sum + parseFloat(will.balance || '0'), 0).toFixed(4)} ETH
                                    </StatNumber>
                                    <StatHelpText>Во всех завещаниях</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>

                        <Card bg={cardBg} borderRadius="xl" boxShadow="lg">
                            <CardBody>
                                <Stat>
                                    <StatLabel color={textColor}>Последняя активность</StatLabel>
                                    <StatNumber fontSize="md" color="blue.500">
                                        {lastPing}
                                    </StatNumber>
                                    <StatHelpText>Подтверждение жизни</StatHelpText>
                                </Stat>
                            </CardBody>
                        </Card>
                    </SimpleGrid>

                    {/* Список завещаний */}
                    <VStack spacing={6} align="stretch">
                        {wills.map((will, index) => (
                            <Card
                                key={will.address}
                                bg={cardBg}
                                borderRadius="xl"
                                boxShadow="lg"
                                border="1px solid"
                                borderColor={borderColor}
                                transition="all 0.3s cubic-bezier(0.4, 0, 0.2, 1)"
                                _hover={{
                                    transform: "translateY(-2px)",
                                    boxShadow: "xl",
                                    borderColor: "#081781"
                                }}
                            >
                                <CardHeader pb={2}>
                                    <HStack justify="space-between">
                                        <HStack spacing={3}>
                                            <Icon as={FaUser} color="blue.500" boxSize={5} />
                                            <VStack align="start" spacing={0}>
                                                <Heading size="md" color="#081781">
                                                    {will.heirName}
                                                </Heading>
                                                <Badge colorScheme="blue" variant="subtle" borderRadius="md">
                                                    {will.heirRole}
                                                </Badge>
                                            </VStack>
                                        </HStack>
                                        <Badge colorScheme="green" variant="outline" fontSize="sm" px={3} py={1}>
                                            Завещание #{index + 1}
                                        </Badge>
                                    </HStack>
                                </CardHeader>

                                <CardBody pt={2}>
                                    <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} spacing={6}>
                                        {/* Информация о наследнике */}
                                        <VStack align="start" spacing={3}>
                                            <HStack>
                                                <Icon as={FaWallet} color="gray.500" />
                                                <Text fontSize="sm" fontWeight="semibold" color={textColor}>
                                                    Кошелек наследника
                                                </Text>
                                            </HStack>
                                            <Text fontSize="sm" fontFamily="monospace" color="blue.500">
                                                {`${will.heir.slice(0, 6)}...${will.heir.slice(-4)}`}
                                            </Text>
                                        </VStack>

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
                                                    <strong>Баланс:</strong> {will.balance} ETH
                                                </Text>
                                                <Text fontSize="sm">
                                                    <strong>Перевод:</strong> {will.transferAmount} ETH
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
                                                    Временные настройки
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
                                            </VStack>
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

                    {/* Кнопка подтверждения жизни */}
                    <Card
                        bg={useColorModeValue('blue.50', 'blue.900')}
                        borderRadius="xl"
                        border="2px solid"
                        borderColor="blue.200"
                        boxShadow="lg"
                    >
                        <CardBody>
                            <VStack spacing={6}>
                                <VStack spacing={2} textAlign="center">
                                    <HStack>
                                        <Icon as={FaHeartbeat} color="red.500" boxSize={6} />
                                        <Heading size="md" color="#081781">
                                            Подтверждение активности
                                        </Heading>
                                    </HStack>
                                    <Text color={textColor} fontSize="sm" maxW="500px">
                                        Регулярно подтверждайте свою активность, чтобы завещания оставались под вашим контролем
                                    </Text>
                                </VStack>

                                <Button
                                    onClick={handlePingAll}
                                    colorScheme="blue"
                                    size="lg"
                                    isLoading={pingLoading}
                                    loadingText="Отправка подтверждения..."
                                    width={{ base: "100%", md: "auto" }}
                                    px={12}
                                    py={6}
                                    fontSize="lg"
                                    fontWeight="bold"
                                    leftIcon={<Icon as={FaHeartbeat} />}
                                    bgGradient="linear(to-r, #081781, #061264)"
                                    color="white"
                                    _hover={{
                                        bgGradient: "linear(to-r, #061264, #040d47)",
                                        transform: "translateY(-2px)",
                                        boxShadow: "xl"
                                    }}
                                    _active={{ transform: "translateY(0)" }}
                                    transition="all 0.2s cubic-bezier(0.4, 0, 0.2, 1)"
                                    borderRadius="xl"
                                >
                                    Я жив и здоров!
                                </Button>

                                <Alert status="info" borderRadius="lg" variant="subtle">
                                    <AlertIcon />
                                    <AlertDescription fontSize="sm">
                                        Последнее подтверждение: <strong>{lastPing}</strong>
                                    </AlertDescription>
                                </Alert>
                            </VStack>
                        </CardBody>
                    </Card>
                </>
            )}
        </VStack>
    );
});

export default MyWills;
