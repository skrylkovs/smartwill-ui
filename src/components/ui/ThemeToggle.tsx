import { IconButton, useColorMode, useColorModeValue } from '@chakra-ui/react'
import { SunIcon, MoonIcon } from '@chakra-ui/icons'

export const ThemeToggle = () => {
  const { colorMode, toggleColorMode } = useColorMode()
  const SwitchIcon = useColorModeValue(MoonIcon, SunIcon)
  
  return (
    <IconButton
      aria-label="Переключить тему"
      icon={<SwitchIcon />}
      onClick={toggleColorMode}
      variant="ghost"
      size="md"
      borderRadius="full"
      _hover={{
        bg: useColorModeValue('gray.200', 'gray.700'),
        transform: 'scale(1.1)',
      }}
      transition="all 0.2s"
    />
  )
} 