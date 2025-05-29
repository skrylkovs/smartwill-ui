import { IconButton, useColorMode } from '@chakra-ui/react'
import { FiSun } from 'react-icons/fi'

export const ThemeToggle = () => {
  const { toggleColorMode } = useColorMode()

  return (
    <IconButton
      aria-label="toggle color mode"
      icon={<FiSun />}
      onClick={toggleColorMode}
    />
  )
} 