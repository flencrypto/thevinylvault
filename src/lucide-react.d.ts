declare module 'lucide-react/dist/esm/icons/*' {
  import { LucideProps } from 'lucide-react'
  import { ForwardRefExoticComponent, RefAttributes } from 'react'
  const Component: ForwardRefExoticComponent<
    Omit<LucideProps, 'ref'> & RefAttributes<SVGSVGElement>
  >
  export default Component
}
