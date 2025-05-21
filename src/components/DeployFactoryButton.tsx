import { useState } from "react";
import { Button, useToast } from "@chakra-ui/react";
import { ethers } from "ethers";
import factoryAbi from "../contracts/SmartWillFactory.json";

interface Props {
  signer: ethers.Signer;
  onFactoryDeployed: (address: string) => void;
}

export default function DeployFactoryButton({ signer, onFactoryDeployed }: Props) {
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const deployFactory = async () => {
    try {
      setLoading(true);
      
      // Создаем фабрику контрактов
      const factory = new ethers.ContractFactory(
        factoryAbi.abi,
        factoryAbi.bytecode,
        signer
      );
      
      // Деплоим контракт
      const contract = await factory.deploy();
      
      toast({
        title: "Транзакция отправлена",
        description: "Ожидание подтверждения...",
        status: "info",
        duration: 5000
      });
      
      // Ждем завершения деплоя
      await contract.waitForDeployment();
      
      // Получаем адрес нового контракта
      const contractAddress = await contract.getAddress();
      
      // Сохраняем адрес в localStorage
      localStorage.setItem("factoryAddress", contractAddress);
      
      toast({
        title: "Фабрика развернута",
        description: `Адрес фабрики: ${contractAddress}`,
        status: "success",
        duration: 5000
      });
      
      // Вызываем коллбек
      onFactoryDeployed(contractAddress);
    } catch (err: any) {
      toast({
        title: "Ошибка деплоя",
        description: err.message,
        status: "error",
        duration: 5000
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      colorScheme="purple"
      onClick={deployFactory}
      isLoading={loading}
      loadingText="Деплой..."
    >
      Развернуть фабрику контрактов
    </Button>
  );
} 