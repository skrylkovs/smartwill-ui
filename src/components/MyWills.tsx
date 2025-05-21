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
    Icon
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
    transferAmount: string;
    transferFrequency: string;
}

// Изменяем на forwardRef и экспортируем методы через useImperativeHandle
const MyWills = forwardRef(({ signer, factoryAddress }: MyWillsProps, ref) => {
    const [wills, setWills] = useState<WillInfo[]>([]);
    const [lastPing, setLastPing] = useState<string>("Загрузка...");
    const [loading, setLoading] = useState(false);
    const [pingLoading, setPingLoading] = useState(false);
    const toast = useToast();

    // Получение информации о завещании
    const fetchWillInfo = async (willAddress: string) => {
        try {
            const contract = new ethers.Contract(willAddress, SmartWillAbi.abi, signer);
            
            // Получаем основную информацию из контракта завещания
            const [balance, heir, transferAmount, transferFrequency] = await Promise.all([
                contract.getBalance(),
                contract.heir(),
                contract.transferAmount(),
                contract.transferFrequency()
            ]);

            return {
                address: willAddress,
                balance: ethers.formatEther(balance),
                heir,
                transferAmount: ethers.formatEther(transferAmount),
                transferFrequency: transferFrequency.toString()
            };
        } catch (error) {
            console.error(`Ошибка при получении информации о завещании ${willAddress}:`, error);
            return null;
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
            setPingLoading(true);
            const factory = new ethers.Contract(factoryAddress, factoryAbi.abi, signer);
            
            // Отправляем один пинг в фабрику
            const tx = await factory.ping();
            await tx.wait();
            
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
            <VStack spacing={4} align="stretch">
                <HStack justifyContent="space-between">
                    <Heading size="md">Мои завещания</Heading>
                    <Button 
                        size="sm" 
                        onClick={refreshWills} 
                        leftIcon={<Icon as={RepeatIcon} />}
                        isLoading={loading}
                    >
                        Обновить
                    </Button>
                </HStack>
                {loading ? (
                    <Center p={10}>
                        <VStack>
                            <Spinner size="xl" />
                            <Text mt={2}>Загрузка завещаний...</Text>
                        </VStack>
                    </Center>
                ) : wills.length === 0 ? (
                    <Text>У вас пока нет завещаний</Text>
                ) : (
                    <>
                        <List spacing={3}>
                            {wills.map((will) => (
                                <ListItem key={will.address} p={4} border="1px" borderColor="gray.200" borderRadius="md">
                                    <Box>
                                        <Text><strong>Адрес контракта:</strong> {will.address}</Text>
                                        <Text><strong>Баланс:</strong> {will.balance} ETH</Text>
                                        <Text><strong>Наследник:</strong> {will.heir}</Text>
                                        <Text><strong>Сумма перевода:</strong> {will.transferAmount} ETH</Text>
                                        <Text><strong>Частота переводов:</strong> {will.transferFrequency} сек.</Text>
                                    </Box>
                                </ListItem>
                            ))}
                        </List>
                        
                        <Box mt={6} p={4} borderWidth={1} borderRadius="md" borderColor="blue.200" bg="blue.50">
                            <VStack spacing={4} align="center">
                                <Button 
                                    onClick={handlePingAll}
                                    colorScheme="blue"
                                    size="lg"
                                    isLoading={pingLoading}
                                    loadingText="Отправка..."
                                    width="100%"
                                >
                                    Подтвердить, что я жив
                                </Button>
                                
                                <Divider />
                                
                                <Box textAlign="center">
                                    <Text fontSize="sm" color="gray.600">Последнее подтверждение:</Text>
                                    <Text fontWeight="bold">{lastPing}</Text>
                                </Box>
                            </VStack>
                        </Box>
                    </>
                )}
            </VStack>
        </Box>
    );
});

export default MyWills; 