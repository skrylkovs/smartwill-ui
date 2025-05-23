import { useState, useEffect, forwardRef, useImperativeHandle } from "react";
import { ethers } from "ethers";
import {
    Box,
    Button,
    Text,
    VStack,
    Heading,
    List,
    ListItem,
    Spinner,
    HStack,
    Flex,
    useToast,
    Divider,
    Center,
    Icon,
    Grid
} from "@chakra-ui/react";
import { RepeatIcon } from "@chakra-ui/icons";
import SmartWillAbi from "../contracts/SmartWill.json";
import factoryAbi from "../contracts/SmartWillFactory.json";

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
    limit: string;
}

// Изменяем на forwardRef и экспортируем методы через useImperativeHandle
const MyWills = forwardRef(({ signer, factoryAddress }: MyWillsProps, ref) => {
    const [wills, setWills] = useState<WillInfo[]>([]);
    const [lastPing, setLastPing] = useState<string>("Загрузка...");
    const [loading, setLoading] = useState(false);
    const [pingLoading, setPingLoading] = useState(false);
    const toast = useToast();

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
            const [balance, heir, heirName, heirRole, transferAmount, transferFrequency, limit] = await Promise.all([
                contract.getBalance(),
                contract.heir(),
                contract.heirName(),
                contract.heirRole(),
                contract.transferAmount(),
                contract.transferFrequency(),
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

            // Отправляем один пинг в фабрику
            const tx = await factory.ping();

            toast({
                title: "Успешно!",
                description: `Вы подтвердили, что живы.`,
                status: "success",
                duration: 5000,
                isClosable: true,
            });

            // Обновляем информацию о последнем пинге
            await fetchLastPing();

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
            
            // Получаем все развернутые завещания
            // Используем альтернативный подход для получения списка завещаний
            let willsList = [];
            try {
                // Пробуем получить список всех завещаний напрямую
                willsList = await factory.getDeployedWills();
            } catch (error) {
                console.log("Ошибка при вызове getDeployedWills, пробуем альтернативный метод:", error);
                
                // Если напрямую не получилось, получаем длину массива и считываем по одному
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
            
            console.log("Найдено завещаний:", willsList.length);
            
            // Если список завещаний пуст, завершаем работу
            if (willsList.length === 0) {
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
            
            // Отображаем все завещания, не фильтруя по владельцу
            const validWills = willsInfo.filter(Boolean) as WillInfo[];
            console.log("Валидных завещаний:", validWills.length);
            
            setWills(validWills);

            // Получаем информацию о последнем пинге
            await fetchLastPing();
        } catch (error) {
            console.error("Ошибка при загрузке завещаний:", error);
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
        <Box w="100%">
            <HStack justifyContent="space-between" mb={6}>
                <Heading size="md" fontWeight="semibold">Мои завещания</Heading>
                <Button 
                    size="sm" 
                    onClick={refreshWills} 
                    leftIcon={<Icon as={RepeatIcon} />}
                    isLoading={loading}
                    colorScheme="purple"
                    variant="outline"
                    _hover={{ bg: 'purple.50' }}
                >
                    Обновить
                </Button>
            </HStack>
            {loading ? (
                <Center p={10}>
                    <VStack>
                        <Spinner size="xl" color="purple.500" thickness="3px" speed="0.8s" />
                        <Text mt={4} color="gray.600">Загрузка завещаний...</Text>
                    </VStack>
                </Center>
            ) : wills.length === 0 ? (
                <Box py={10} textAlign="center">
                    <VStack spacing={4}>
                        <Icon as={RepeatIcon} w={12} h={12} color="gray.300" />
                        <Text fontSize="lg" color="gray.500" fontWeight="medium">У вас пока нет завещаний</Text>
                        <Text fontSize="md" color="gray.500">Создайте новое завещание, чтобы начать</Text>
                    </VStack>
                </Box>
            ) : (
                <>
                    <List spacing={4}>
                        {wills.map((will) => (
                            <ListItem 
                                key={will.address} 
                                p={5} 
                                borderWidth="1px" 
                                borderColor="gray.200" 
                                borderRadius="lg" 
                                boxShadow="sm"
                                transition="all 0.2s"
                                _hover={{ boxShadow: 'md', borderColor: 'purple.200' }}
                                bg="white"
                            >
                                <Box>
                                    <Heading size="sm" fontWeight="semibold" mb={3} color="purple.700">
                                        {will.heirName}
                                    </Heading>
                                    <Grid templateColumns={{ base: "1fr", md: "1fr 1fr" }} gap={4}>
                                        <VStack align="start" spacing={2}>
                                            <Text fontSize="sm"><strong>Роль наследника:</strong> {will.heirRole}</Text>
                                            <Text fontSize="sm"><strong>Кошелек наследника:</strong> {will.heir}</Text>
                                            <Text fontSize="sm"><strong>Баланс:</strong> {will.balance} ETH</Text>
                                        </VStack>
                                        <VStack align="start" spacing={2}>
                                            <Text fontSize="sm"><strong>Сумма регулярного перевода:</strong> {will.transferAmount} ETH</Text>
                                            <Text fontSize="sm"><strong>Частота выплат:</strong> {
                                                Number(will.transferFrequency) < 60 
                                                    ? `${will.transferFrequency} сек.` 
                                                    : `${Math.floor(Number(will.transferFrequency) / 60)} мин.`
                                            }</Text>
                                            <Text fontSize="sm"><strong>Лимит:</strong> {will.limit} ETH</Text>
                                        </VStack>
                                    </Grid>
                                    <Text color="blue.500" fontSize="sm" mt={4} opacity={0.8}>
                                        <strong>Адрес контракта:</strong> {will.address}
                                    </Text>
                                </Box>
                            </ListItem>
                        ))}
                    </List>
                    
                    <Box 
                        mt={8} 
                        p={6} 
                        borderRadius="lg" 
                        borderWidth="1px"
                        borderColor="blue.200" 
                        bg="blue.50"
                        boxShadow="md"
                    >
                        <VStack spacing={5} align="center">
                            <Button 
                                onClick={handlePingAll}
                                colorScheme="blue"
                                size="lg"
                                isLoading={pingLoading}
                                loadingText="Отправка..."
                                width="100%"
                                height="60px"
                                boxShadow="sm"
                                _hover={{ transform: "translateY(-2px)", boxShadow: "md" }}
                                transition="all 0.2s"
                            >
                                Подтвердить, что я жив
                            </Button>
                            
                            <Divider />
                            
                            <Box textAlign="center">
                                <Text fontSize="sm" color="gray.600" mb={1}>Последнее подтверждение:</Text>
                                <Text fontWeight="bold" fontSize="md">{lastPing}</Text>
                            </Box>
                        </VStack>
                    </Box>
                </>
            )}
        </Box>
    );
});

export default MyWills; 