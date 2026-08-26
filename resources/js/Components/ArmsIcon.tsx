import { SVGAttributes } from 'react';

export type ArmsIconName =
    | 'building'
    | 'chart'
    | 'chevron'
    | 'clock'
    | 'document'
    | 'folder'
    | 'gear'
    | 'menu'
    | 'shield'
    | 'upload'
    | 'users'
    | 'x';

interface ArmsIconProps extends SVGAttributes<SVGElement> {
    name: ArmsIconName;
}

const paths: Record<ArmsIconName, JSX.Element> = {
    building: (
        <>
            <path d="M4 21h16M6 21V7l6-4 6 4v14M9 10h1m4 0h1m-6 4h1m4 0h1m-6 4h1m4 0h1" />
        </>
    ),
    chart: <path d="M4 19V9m6 10V5m6 14v-7m4 7H2" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
        <>
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
        </>
    ),
    document: (
        <>
            <path d="M6 3h8l4 4v14H6z" />
            <path d="M14 3v5h4M9 13h6m-6 4h6" />
        </>
    ),
    folder: <path d="M3 6h7l2 2h9l-2 11H4z" />,
    gear: (
        <>
            <circle cx="12" cy="12" r="3" />
            <path d="M19 13.5v-3l-2-.7-.7-1.7.9-1.9-2.1-2.1-1.9.9-1.7-.7L10.5 2h-3l-.7 2-1.7.7-1.9-.9-2.1 2.1.9 1.9-.7 1.7-2 .7v3l2 .7.7 1.7-.9 1.9 2.1 2.1 1.9-.9 1.7.7.7 2h3l.7-2 1.7-.7 1.9.9 2.1-2.1-.9-1.9.7-1.7z" />
        </>
    ),
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    shield: (
        <>
            <path d="M12 2 20 5v6c0 5.5-3.2 9.2-8 11-4.8-1.8-8-5.5-8-11V5z" />
            <path d="M9 12h6v5H9zM10 12v-2a2 2 0 0 1 4 0v2" />
        </>
    ),
    upload: <path d="M12 16V4m-4 4 4-4 4 4M5 14v6h14v-6" />,
    users: (
        <>
            <circle cx="9" cy="8" r="3" />
            <path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2" />
        </>
    ),
    x: <path d="m6 6 12 12M18 6 6 18" />,
};

export default function ArmsIcon({
    name,
    className = 'h-5 w-5',
    ...props
}: ArmsIconProps) {
    return (
        <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
            {...props}
        >
            {paths[name]}
        </svg>
    );
}
