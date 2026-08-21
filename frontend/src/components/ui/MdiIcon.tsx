import Icon from '@mdi/react'
import type { IconProps } from '@mdi/react/dist/IconProps'

interface MdiIconProps extends Omit<IconProps, 'path' | 'size'> {
  path: string
  size?: number | string
  className?: string
}

export function MdiIcon({ path, size = 0.9, className, ...props }: MdiIconProps) {
  return <Icon path={path} size={size} className={className} aria-hidden="true" {...props} />
}
