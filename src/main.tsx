import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, extendTheme, ThemeConfig } from "@chakra-ui/react";
import App from "./App";

// ✅ Новая тема (возможно, требуются изменения в Chakra UI 3)
const config: ThemeConfig = {
    initialColorMode: "light",
    useSystemColorMode: false,
};

const theme = extendTheme({ config });

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
        <ChakraProvider theme={theme}>
            <App />
        </ChakraProvider>
    </React.StrictMode>
);