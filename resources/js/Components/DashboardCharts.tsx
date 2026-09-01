import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Filler,
    Legend,
    LineController,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    ChartData,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
    BarController,
    BarElement,
    CategoryScale,
    Filler,
    Legend,
    LineController,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
);

interface ActivityPoint {
    cumulative: number;
    label: string;
    uploads: number;
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
                backgroundColor: 'arms-green',
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
                pointBorderColor: '',
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
