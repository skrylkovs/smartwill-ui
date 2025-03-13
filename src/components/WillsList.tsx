import { Box, Button, Heading, VStack } from "@chakra-ui/react";
import { ethers } from "ethers";
import smartWillAbi from "../contracts/SmartWill.json";

interface Props {
    wills: string[];
    signer: ethers.Signer;
}

export default function WillsList({ wills, signer }: Props) {
    const handlePing = async (address: string) => {
        const contract = new ethers.Contract(address, smartWillAbi.abi, signer);
        const tx = await contract.ping();
        await tx.wait();
        alert("PING отправлен в " + address);
    };

    return (
        <Box mt={6}>
            <Heading size="md" mb={2}>Список завещаний</Heading>
            <VStack spacing={3} align="stretch">
                {wills.map(addr => (
                    <Box key={addr} borderWidth={1} p={3} borderRadius="md">
                        <strong>{addr}</strong>
                        <Button onClick={() => handlePing(addr)} colorScheme="blue" ml={4}>
                            Подтвердить, что я жив
                        </Button>
                    </Box>
                ))}
            </VStack>
        </Box>
    );
}