import { useState } from "react";
import { ethers } from "ethers";
import INCOTokenAbi from "../contracts/INCOToken.json";
import { Button, Input, HStack, useToast } from "@chakra-ui/react";

interface Props {
  signer: ethers.Signer;
  tokenAddress: string;
}

export default function BuyTokenButton({ signer, tokenAddress }: Props) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleBuy = async () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast({ title: "Enter ETH amount", status: "warning" });
      return;
    }
    setLoading(true);
    try {
      const contract = new ethers.Contract(tokenAddress, INCOTokenAbi.abi, signer);
      const overrides = { value: ethers.parseEther(amount) };
      const tx = await contract.buyTokensWithETH(overrides);
      await tx.wait();
      toast({ title: "Purchase successful!", status: "success" });
      setAmount("");
    } catch (e: any) {
      toast({ title: "Purchase error", description: e.message, status: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <HStack>
      <Input
        placeholder="Amount"
        value={amount}
        onChange={e => setAmount(e.target.value)}
        type="number"
        min="0"
        step="0.0001"
        width="200px"
        isDisabled={loading}
      />
      <Button
        colorScheme="green"
        onClick={handleBuy}
        isLoading={loading}
        loadingText="Buying..."
      >
        Buy tokens
      </Button>
    </HStack>
  );
}
