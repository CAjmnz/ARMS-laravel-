import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    ChartData,
} from 'chart.js';
import { Chart, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    Filler,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
);

interface DocumentStatus {
    published: number;
    publishedPercentage: number;
    total: number;
    unpublished: number;
    unpublishedPercentage: number;
}

interface ActivityPoint {
    cumulative: number;
    label: string;
    uploads: number;
}

export function DocumentStatusChart({ status }: { status: DocumentStatus }) {
    if (status.total === 0) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-500">
                No folder publication data is available yet.
            </div>
        );
    }

    const data: ChartData<'doughnut', number[], string> = {
        labels: ['Published', 'Unpublished'],
        datasets: [
            {
                data: [status.published, status.unpublished],
                backgroundColor: ['#08613f', '#d4a936'],
                borderColor: '#ffffff',
                borderWidth: 3,
                hoverOffset: 4,
            },
        ],
    };

    return (
        <div className="grid items-center gap-6 sm:grid-cols-[minmax(0,240px)_1fr]">
            <div className="relative mx-auto h-56 w-56">
                <Doughnut
                    data={data}
                    options={{
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false,
                            },
                            tooltip: {
                                callbacks: {
                                    label: (context) =>
                                        `${context.label}: ${context.formattedValue}`,
                                },
                            },
                        },
                    }}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <span className="font-serif text-2xl font-semibold text-[#073d2f]">
                        {status.publishedPercentage}%
                    </span>
                </div>
            </div>

            <dl className="space-y-4 text-sm">
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
                    <dt className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-[#08613f]" />
                        Published
                    </dt>
                    <dd className="font-semibold">{status.published}</dd>
                    <dd className="text-stone-500">
                        {status.publishedPercentage}%
                    </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto_auto] items-center gap-4">
                    <dt className="flex items-center gap-2">
                        <span className="h-3 w-3 rounded-full bg-[#d4a936]" />
                        Unpublished
                    </dt>
                    <dd className="font-semibold">{status.unpublished}</dd>
                    <dd className="text-stone-500">
                        {status.unpublishedPercentage}%
                    </dd>
                </div>
                <div className="grid grid-cols-[1fr_auto] border-t border-stone-200 pt-4">
                    <dt>Total</dt>
                    <dd className="font-semibold">{status.total}</dd>
                </div>
            </dl>

            <table className="sr-only">
                <caption>Document publication status</caption>
                <tbody>
                    <tr>
                        <th>Published</th>
                        <td>{status.published}</td>
                    </tr>
                    <tr>
                        <th>Unpublished</th>
                        <td>{status.unpublished}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}

export function DocumentActivityChart({
    activity,
}: {
    activity: ActivityPoint[];
}) {
    const hasActivity = activity.some(
        (point) => point.uploads > 0 || point.cumulative > 0,
    );

    if (!hasActivity) {
        return (
            <div className="flex h-64 items-center justify-center rounded-xl bg-stone-50 text-sm text-stone-500">
                No document activity is available for the last six months.
            </div>
        );
    }

    const data: ChartData<'bar' | 'line', number[], string> = {
        labels: activity.map((point) => point.label),
        datasets: [
            {
                type: 'bar' as const,
                label: 'Uploads',
                data: activity.map((point) => point.uploads),
                backgroundColor: '#08613f',
                borderRadius: 6,
                maxBarThickness: 42,
                yAxisID: 'y',
            },
            {
                type: 'line' as const,
                label: 'Cumulative total',
                data: activity.map((point) => point.cumulative),
                borderColor: '#0f6b4e',
                backgroundColor: '#d4a936',
                borderWidth: 2,
                pointBackgroundColor: '#d4a936',
                pointBorderColor: '#08613f',
                pointRadius: 4,
                tension: 0.3,
                yAxisID: 'cumulative',
            },
        ],
    };

    return (
        <div className="h-64">
            <Chart<'bar' | 'line'>
                type="bar"
                data={data}
                options={{
                    maintainAspectRatio: false,
                    responsive: true,
                    interaction: {
                        intersect: false,
                        mode: 'index',
                    },
                    plugins: {
                        legend: {
                            labels: {
                                boxHeight: 10,
                                boxWidth: 10,
                                color: '#38554c',
                                usePointStyle: true,
                            },
                            position: 'bottom',
                        },
                    },
                    scales: {
                        cumulative: {
                            beginAtZero: true,
                            grid: {
                                display: false,
                            },
                            position: 'right',
                        },
                        x: {
                            grid: {
                                display: false,
                            },
                        },
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: '#eeeae3',
                            },
                            position: 'left',
                        },
                    },
                }}
            />

            <table className="sr-only">
                <caption>Document activity for the last six months</caption>
                <thead>
                    <tr>
                        <th>Month</th>
                        <th>Uploads</th>
                        <th>Cumulative total</th>
                    </tr>
                </thead>
                <tbody>
                    {activity.map((point) => (
                        <tr key={point.label}>
                            <td>{point.label}</td>
                            <td>{point.uploads}</td>
                            <td>{point.cumulative}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
