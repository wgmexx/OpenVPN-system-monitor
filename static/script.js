let cpuChart, ramChart, diskChart, pingChart; // Глобальные переменные для графиков
let pingData = []; // Массив для хранения данных пинга

function formatDuration(seconds) {
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days} дн. ${hours} ч. ${minutes} мин.`; // Исправлено
}

async function fetchStatus() {
    try {
        const response = await fetch('https://wgmexx.ru/status'); // Изменено на /status
        const data = await response.json();

        // Логирование статуса сервера
        console.log(data.server_status); // Добавьте эту строку
		function updateStatusIndicator(isRunning) {
			const indicator = document.querySelector('.indicator');
    
			if (isRunning) {
				indicator.classList.remove('red');
				indicator.classList.add('green');
			} else {
				indicator.classList.remove('green');
				indicator.classList.add('red');
			}
		}

// Пример вызова функции с реальным статусом
const isOpenVPNRunning = true; // Это значение должно приходить от сервера
updateStatusIndicator(isOpenVPNRunning);

        // Обновление времени работы OpenVPN
        const openvpnUptime = formatDuration(data.server_uptime_seconds);
        document.getElementById('openvpn-uptime').innerText = `OpenVPN запущен: ${openvpnUptime}`; // Исправлено

        // Обновление таблицы клиентов
        const clientsTableBody = document.getElementById('clients-table').querySelector('tbody');
        clientsTableBody.innerHTML = ''; // Очистить предыдущие данные
        data.clients.forEach(client => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${client['Common Name']}</td>
                <td>${client['Real Address']}</td>
                <td>${(client['Bytes Received'] / (1024 ** 3)).toFixed(2)}</td>
                <td>${(client['Bytes Sent'] / (1024 ** 3)).toFixed(2)}</td>
                <td>${client['Connected Since']}</td>
                <td>${formatDuration(Math.floor(client['Connection Duration']))}</td>
            `; // Исправлено
            clientsTableBody.appendChild(row);
        });

        // Обновление диаграмм и процентов
        updateCharts(data.system_metrics);

        // Обновление времени последнего обновления
        const currentTime = new Date().toLocaleString();
        document.getElementById('last-updated').innerText = `Последнее обновление: ${currentTime}`; // Исправлено
    } catch (error) {
        console.error('Ошибка при получении статуса:', error);
    }
}

function updateCharts(metrics) {
    // Обновляем данные графиков вместо их перерисовки
    if (!cpuChart) {
        const cpuCtx = document.getElementById('cpuChart').getContext('2d');
        cpuChart = new Chart(cpuCtx, {
            type: 'doughnut',
            data: {
                labels: ['Использовано', 'Свободно'],
                datasets: [{
                    data: [metrics.cpu, 100 - metrics.cpu],
                    backgroundColor: ['#00A591', '#B4B7BA'], // Цвета для CPU
                    borderColor: ['#00A591', '#B4B7BA'], // Цвет границы
                    borderWidth: [10, 2] // Ширина границ: широкая для использованной и узкая для свободной
                }]
            },
            options: {
                cutout: '70%', // Увеличиваем вырез в центре для стиля
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                animation: false // Отключаем анимацию
            }
        });
    } else {
        cpuChart.data.datasets[0].data = [metrics.cpu, 100 - metrics.cpu];
        cpuChart.update({ duration: 0 }); // Обновляем график без анимации
    }

    const ramUsedPercent = (metrics.ram.used / metrics.ram.total) * 100;
    if (!ramChart) {
        const ramCtx = document.getElementById('ramChart').getContext('2d');
        ramChart = new Chart(ramCtx, {
            type: 'doughnut',
            data: {
                labels: ['Использовано', 'Свободно'],
                datasets: [{
                    data: [ramUsedPercent, 100 - ramUsedPercent],
                    backgroundColor: ['#00A591', '#B4B7BA'], // Цвета для RAM
                    borderColor: ['#00A591', '#B4B7BA'], // Цвет границы
                    borderWidth: [10, 2] // Ширина границ: широкая для использованной и узкая для свободной
                }]
            },
            options: {
                cutout: '70%', // Увеличиваем вырез в центре для стиля
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                animation: false // Отключаем анимацию
            }
        });
    } else {
        ramChart.data.datasets[0].data = [ramUsedPercent, 100 - ramUsedPercent];
        ramChart.update({ duration: 0 }); // Обновляем график без анимации
    }

    const diskUsedPercent = (metrics.disk.used / metrics.disk.total) * 100;
    if (!diskChart) {
        const diskCtx = document.getElementById('diskChart').getContext('2d');
        diskChart = new Chart(diskCtx, {
            type: 'doughnut',
            data: {
                labels: ['Использовано', 'Свободно'],
                datasets: [{
                    data: [diskUsedPercent, 100 - diskUsedPercent],
                    backgroundColor: ['#00A591', '#B4B7BA'], // Цвета для диска
                    borderColor: ['#00A591', '#B4B7BA'], // Цвет границы
                    borderWidth: [10, 2] // Ширина границ: широкая для использованной и узкая для свободной
                }]
            },
            options: {
                cutout: '70%', // Увеличиваем вырез в центре для стиля
                plugins: {
                    legend: {
                        display: true,
                        position: 'top'
                    }
                },
                animation: false // Отключаем анимацию
            }
        });
    } else {
        diskChart.data.datasets[0].data = [diskUsedPercent, 100 - diskUsedPercent];
        diskChart.update({ duration: 0 }); // Обновляем график без анимации
    }

    // Обновляем проценты
    document.getElementById('cpu-percent').innerText = metrics.cpu.toFixed(2);
    document.getElementById('ram-percent').innerText = ramUsedPercent.toFixed(2);
    document.getElementById('disk-percent').innerText = diskUsedPercent.toFixed(2);
}

async function fetchConnectionHistory() {
    try {
        const response = await fetch('https://wgmexx.ru/connection_history', { cache: 'no-cache' }); // Изменено на /connection_history
        const history = await response.json();

        const historyTableBody = document.getElementById('history-table').querySelector('tbody');
        historyTableBody.innerHTML = ''; // Очистить предыдущие данные
        for (const [commonName, data] of Object.entries(history)) {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${commonName}</td>
                <td>${(data['Total Bytes Received'] / (1024 ** 3)).toFixed(2)}</td>
                <td>${(data['Total Bytes Sent'] / (1024 ** 3)).toFixed(2)}</td>
                <td>${data['Last Disconnection Time']}</td> <!-- Добавлено время последнего отключения -->
            `; // Исправлено
            historyTableBody.appendChild(row);
        }
    } catch (error) {
        console.error('Ошибка при получении истории подключений:', error);
    }
}

function sortTable(columnIndex) {
    const table = document.getElementById('clients-table');
    const rows = Array.from(table.rows).slice(1); // Пропускаем заголовок таблицы
    const isAscending = table.dataset.sortOrder === 'asc';
    const direction = isAscending ? 1 : -1;

    // Сортируем строки на основе текста в нужной колонке
    rows.sort((a, b) => {
        const aText = a.cells[columnIndex].innerText;
        const bText = b.cells[columnIndex].innerText;
        return aText.localeCompare(bText) * direction;
    });

    // Очищаем таблицу перед добавлением отсортированных строк
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    // Добавляем отсортированные строки обратно в таблицу
    rows.forEach(row => tbody.appendChild(row));

    // Обновляем состояние сортировки
    table.dataset.sortOrder = isAscending ? 'desc' : 'asc';
}

function sortHistoryTable(columnIndex) {
    const table = document.getElementById('history-table');
    const rows = Array.from(table.rows).slice(1); // Пропускаем заголовок таблицы
    const isAscending = table.dataset.sortOrder === 'asc';
    const direction = isAscending ? 1 : -1;

    // Сортируем строки на основе текста в нужной колонке
    rows.sort((a, b) => {
        const aText = a.cells[columnIndex].innerText;
        const bText = b.cells[columnIndex].innerText;
        return aText.localeCompare(bText, undefined, { numeric: true }) * direction;
    });

    // Очищаем таблицу перед добавлением отсортированных строк
    const tbody = table.querySelector('tbody');
    tbody.innerHTML = '';

    // Добавляем отсортированные строки обратно в таблицу
    rows.forEach(row => tbody.appendChild(row));

    // Обновляем состояние сортировки
    table.dataset.sortOrder = isAscending ? 'desc' : 'asc';
}

// Функция для пинга до сервера
async function calculatePing() {
    const serverUrl = 'system_monitor';
    const startTime = performance.now();

    try {
        const response = await fetch(serverUrl, { method: 'GET', cache: 'no-cache' });
        if (!response.ok) {
            throw new Error('Сервер вернул ошибку');
        }
        const endTime = performance.now();
        const ping = Math.round(endTime - startTime);
        document.getElementById('ping-value').textContent = ping;

        // Добавляем значение пинга в массив и обновляем график
        pingData.push(ping);
        if (pingData.length > 50) {
            pingData.shift(); // Удаляем старые значения, если больше 50
        }
        updatePingChart();
    } catch (error) {
        document.getElementById('ping-value').textContent = 'Ошибка';
        console.error('Ошибка при попытке получить пинг:', error);
    }
}

function updatePingChart() {
    const pingCtx = document.getElementById('pingChart');
	pingCtx.width = pingCtx.offsetWidth; // Установка ширины в соответствии с шириной контейнера
	pingCtx.height = 300; // Фиксированная высота
    if (!pingCtx) {
        console.error('Элемент pingChart не найден');
        return; // Прерываем выполнение функции, если элемент не найден
    }

    if (!pingChart) {
        const context = pingCtx.getContext('2d');
        pingChart = new Chart(context, {
            type: 'line',
            data: {
                labels: pingData.map((_, index) => index + 1),
                datasets: [{
                    label: 'Пинг (мс)',
                    data: pingData,
                    borderColor: '#00A591', // Цвет линии
					backgroundColor: 'rgba(180, 183, 186, 0.5)', // Цвет фона под линией
					borderWidth: 2,
                    fill: true,
                }]
            },
		options: {
			responsive: true,
			scales: {
				y: {
					beginAtZero: false, // Отключаем привязку к 0
                    min: 50, // Устанавливаем минимальное значение оси Y
					grid: {
                    color: '#333' // Цвет сетки
					},
					ticks: {
						color: '#e0e0e0' // Цвет текста на оси Y
					}
				},
				x: {
					grid: {
						color: '#333' // Цвет сетки
					},
					ticks: {
						color: '#e0e0e0' // Цвет текста на оси X
					}
				}
			},
			plugins: {
            legend: {
                labels: {
                    color: '#e0e0e0' // Цвет текста легенды
                }
            }
        }
    }
});
    } else {
        pingChart.data.labels = pingData.map((_, index) => index + 1);
        pingChart.data.datasets[0].data = pingData;
        pingChart.update();
    }
}

// Запускаем расчет пинга каждые 3 секунд
setInterval(calculatePing, 3000);

// Выполним расчет при загрузке страницы
calculatePing();

document.addEventListener('DOMContentLoaded', () => {
    fetchStatus();
    fetchConnectionHistory(); // Добавляем первоначальный вызов
    setInterval(fetchStatus, 3000); // Каждые 3 секунд
    setInterval(fetchConnectionHistory, 3000); // Каждые 3 секунд
});