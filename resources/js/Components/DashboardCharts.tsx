import {
    BarController,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    Tooltip,
    ChartData,
} from 'chart.js';
import { Chart } from 'react-chartjs-2';

ChartJS.register(
    BarController,
    BarElement,
    CategoryScale,
    Legend,
    LinearScale,
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

    const barColors = ['#c7c7c7', '#4caf63', '#f2ad25', '#2f8bea', '#7138cf', '#08613f'];
    const data: ChartData<'bar', number[], string> = {
        labels: activity.map((point) => point.label),
        datasets: [
            {
                label: 'Uploads',
                data: activity.map((point) => point.uploads),
                backgroundColor: activity.map((_, index) => barColors[index % barColors.length]),
                borderRadius: 6,
                borderSkipped: false,
                maxBarThickness: 52,
            },
        ],
    };

    return (
        <div className="h-64">
            <Chart<'bar'>
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
                            ticks: {
                                precision: 0,
                            },
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

                    </tr>
                </thead>
                <tbody>
                    {activity.map((point) => (
                        <tr key={point.label}>
                            <td>{point.label}</td>
                            <td>{point.uploads}</td>

                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
