import { extendTheme, type ThemeConfig } from '@chakra-ui/react'

const config: ThemeConfig = {
  initialColorMode: 'dark',
  useSystemColorMode: false,
}

const theme = extendTheme({
  config,
  styles: {
    global: (props: any) => ({
      body: {
        bg: props.colorMode === 'dark' ? 'gray.900' : 'gray.50',
        color: props.colorMode === 'dark' ? 'white' : 'gray.800',
      },
    }),
  },
  colors: {
    brand: {
      50: '#e6f0ff',
      100: '#bfd7ff',
      200: '#99beff',
      300: '#72a5ff',
      400: '#4c8cff',
      500: '#081781',
      600: '#061264',
      700: '#040d47',
      800: '#02082a',
      900: '#01030d',
    },
    purple: {
      50: '#e6f0ff',
      100: '#bfd7ff',
      200: '#99beff',
      300: '#72a5ff',
      400: '#4c8cff',
      500: '#081781',
      600: '#061264',
      700: '#040d47',
      800: '#02082a',
      900: '#01030d',
    },
  },
  components: {
    Button: {
      baseStyle: {
        fontWeight: 'semibold',
        borderRadius: 'xl',
      },
      variants: {
        solid: (props: any) => ({
          bg: props.colorScheme === 'purple' ? 'transparent' : undefined,
          bgGradient: props.colorScheme === 'purple' ? 'linear(to-r, #081781, #061264)' : undefined,
          color: 'white',
          _hover: {
            bg: props.colorScheme === 'purple' ? 'transparent' : undefined,
            bgGradient: props.colorScheme === 'purple' ? 'linear(to-r, #061264, #040d47)' : undefined,
            transform: 'translateY(-2px)',
            boxShadow: 'lg',
          },
          _active: {
            transform: 'translateY(0)',
          },
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }),
        outline: (props: any) => ({
          borderColor: props.colorMode === 'dark' ? 'gray.600' : 'gray.300',
          color: props.colorMode === 'dark' ? 'gray.200' : 'gray.700',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
            borderColor: props.colorScheme === 'purple' ? '#081781' : undefined,
            transform: 'translateY(-1px)',
          },
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        }),
        ghost: (props: any) => ({
          color: props.colorMode === 'dark' ? 'gray.200' : 'gray.700',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          },
        }),
      },
    },
    Card: {
      baseStyle: (props: any) => ({
        container: {
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderRadius: 'xl',
          boxShadow: props.colorMode === 'dark' ? 'dark-lg' : 'lg',
          border: props.colorMode === 'dark' ? '1px solid' : 'none',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'transparent',
        },
      }),
    },
    Box: {
      variants: {
        card: (props: any) => ({
          bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
          borderRadius: 'xl',
          boxShadow: props.colorMode === 'dark' ? 'dark-lg' : 'lg',
          border: props.colorMode === 'dark' ? '1px solid' : 'none',
          borderColor: props.colorMode === 'dark' ? 'gray.700' : 'transparent',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          _hover: {
            transform: 'translateY(-2px)',
            boxShadow: props.colorMode === 'dark' ? 'dark-xl' : 'xl',
          },
        }),
        header: (props: any) => ({
          bg: props.colorMode === 'dark' 
            ? 'linear-gradient(135deg, #1a202c 0%, #2d3748 100%)'
            : 'linear-gradient(135deg, #081781 0%, #061264 100%)',
          borderRadius: 'xl',
          boxShadow: 'lg',
        }),
      },
    },
    Alert: {
      variants: {
        modern: (props: any) => ({
          container: {
            bg: props.colorMode === 'dark' ? 'gray.800' : 'white',
            borderRadius: 'xl',
            border: '1px solid',
            borderColor: props.status === 'error' ? 'red.500' : 
                        props.status === 'warning' ? 'orange.500' :
                        props.status === 'success' ? 'green.500' : 'blue.500',
            boxShadow: 'md',
          },
        }),
      },
    },
    Input: {
      variants: {
        filled: (props: any) => ({
          field: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
            borderRadius: 'lg',
            border: '2px solid transparent',
            _hover: {
              bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
            },
            _focus: {
              bg: props.colorMode === 'dark' ? 'gray.700' : 'white',
              borderColor: '#081781',
              boxShadow: '0 0 0 1px #081781',
            },
          },
        }),
      },
      defaultProps: {
        variant: 'filled',
      },
    },
    Textarea: {
      variants: {
        filled: (props: any) => ({
          bg: props.colorMode === 'dark' ? 'gray.700' : 'gray.100',
          borderRadius: 'lg',
          border: '2px solid transparent',
          _hover: {
            bg: props.colorMode === 'dark' ? 'gray.600' : 'gray.200',
          },
          _focus: {
            bg: props.colorMode === 'dark' ? 'gray.700' : 'white',
            borderColor: '#081781',
            boxShadow: '0 0 0 1px #081781',
          },
        }),
      },
      defaultProps: {
        variant: 'filled',
      },
    },
  },
  shadows: {
    'dark-lg': '0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.2)',
    'dark-xl': '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
  },
  fonts: {
    heading: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
    body: `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"`,
  },
})

export default theme 