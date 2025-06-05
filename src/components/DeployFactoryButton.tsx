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

      // Create contracts factory
      const factory = new ethers.ContractFactory(
        factoryAbi.abi,
        factoryAbi.bytecode,
        signer
      );

      // Deploy contract
      const contract = await factory.deploy();

      toast({
        title: "Transaction Sent",
        description: "Waiting for new factory deployment confirmation...",
        status: "info",
        duration: 5000
      });

      // Wait for deployment completion
      await contract.waitForDeployment();

      // Get new contract address
      const contractAddress = await contract.getAddress();

      // Save address to localStorage
      localStorage.setItem("factoryAddress", contractAddress);

      toast({
        title: "New Factory Deployed",
        description: `New factory address: ${contractAddress}`,
        status: "success",
        duration: 5000
      });

      // Call callback
      onFactoryDeployed(contractAddress);
    } catch (err: any) {
      toast({
        title: "Deployment Error",
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
      loadingText="Deploying..."
      size="sm"
    >
      Create New Factory
    </Button>
  );
}