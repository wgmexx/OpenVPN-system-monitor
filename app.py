# -*- coding: utf-8 -*-
from flask import Flask, jsonify, render_template
from flask_cors import CORS
import os
import subprocess
import psutil
import time
from datetime import datetime
import logging

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "https://wgmexx.ru"}})

STATUS_LOG_PATH = '/var/log/openvpn/status.log'
HISTORY_LOG_PATH = '/var/www/system_monitor/client_connection_history.txt'  # Полный путь

# Настройка логирования
logging.basicConfig(filename='/var/www/system_monitor/error.log', level=logging.ERROR)

previous_clients = {}  # Храним информацию о клиентах для проверки отключений
CHECK_INTERVAL = 5  # Проверяем состояние подключения каждые 5 секунд

def check_openvpn_service():
    """Проверяет статус OpenVPN сервиса."""
    try:
        result = subprocess.run(['systemctl', 'is-active', 'openvpn@server'], capture_output=True, text=True)
        return 'OpenVPN is running' if 'active' in result.stdout else 'OpenVPN is not running'
    except Exception as e:
        logging.error(f'Error checking OpenVPN status: {e}')
        return 'Error checking OpenVPN status'

def get_openvpn_uptime():
    """Получает время работы OpenVPN в секундах."""
    try:
        for proc in psutil.process_iter(['pid', 'name', 'create_time']):
            if proc.info['name'] == 'openvpn':
                uptime = time.time() - proc.info['create_time']
                return uptime
    except Exception as e:
        logging.error(f'Error getting OpenVPN uptime: {e}')
    return None

def parse_openvpn_status_log():
    """Извлекает информацию о подключённых клиентах из openvpn-status.log."""
    if not os.path.exists(STATUS_LOG_PATH):
        logging.error(f'Status log does not exist: {STATUS_LOG_PATH}')
        return []

    global previous_clients
    current_clients = {}
    try:
        with open(STATUS_LOG_PATH, 'r') as f:
            lines = f.readlines()

        client_section = False
        for line in lines:
            if line.startswith('Common Name,'):
                client_section = True
                continue

            if client_section and ',' in line:
                parts = line.strip().split(',')
                if len(parts) >= 5:
                    try:
                        connected_since = datetime.strptime(parts[4], '%Y-%m-%d %H:%M:%S')
                        connection_duration = time.time() - connected_since.timestamp()
                        client_info = {
                            'Common Name': parts[0],
                            'Real Address': parts[1],
                            'Bytes Received': int(parts[3]),
                            'Bytes Sent': int(parts[2]),
                            'Connected Since': parts[4],
                            'Connection Duration': connection_duration if connection_duration >= 0 else 0,
                            'Last Seen': time.time(),  # Время последней активности клиента
                        }
                        current_clients[parts[0]] = client_info
                    except ValueError:
                        continue

        disconnected_clients = previous_clients.keys() - current_clients.keys()
        logging.info(f'Current clients: {current_clients.keys()}')
        logging.info(f'Disconnected clients: {disconnected_clients}')

        # Проверяем клиентов, которые отключились
        for client in disconnected_clients:
            client_data = previous_clients[client]
            log_client_history(client, client_data['Bytes Received'], client_data['Bytes Sent'])
            logging.info(f'Recording disconnection for client: {client}')

        previous_clients = current_clients

    except Exception as e:
        logging.error(f'Error reading status log: {e}')
        return []

    return list(current_clients.values())

def log_client_history(common_name, bytes_received, bytes_sent):
    """Логирует информацию о подключении клиента в файл, суммируя данные по трафику."""
    try:
        logging.info(f'Trying to log history for {common_name}: {bytes_received}, {bytes_sent}')
        with open(HISTORY_LOG_PATH, 'a') as f:
            f.write(f'{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}, {common_name}, {bytes_received}, {bytes_sent}\n')
        logging.info(f'Recorded history: {common_name}, {bytes_received}, {bytes_sent}')
    except Exception as e:
        logging.error(f'Error logging client history: {e}')

def get_connection_history():
    """Получает историю подключений клиентов с суммированными данными и временем последнего отключения."""
    if not os.path.exists(HISTORY_LOG_PATH):
        return {}

    history = {}
    try:
        with open(HISTORY_LOG_PATH, 'r') as f:
            lines = f.readlines()
            for line in lines:
                parts = line.strip().split(', ')
                if len(parts) == 4:
                    common_name = parts[1]
                    try:
                        bytes_received = int(parts[2])
                        bytes_sent = int(parts[3])
                        disconnect_time = parts[0]  # Время отключения

                        if common_name not in history:
                            history[common_name] = {
                                'Total Bytes Received': 0,
                                'Total Bytes Sent': 0,
                                'Last Disconnection Time': disconnect_time  # Добавляем время отключения
                            }

                        history[common_name]['Total Bytes Received'] += bytes_received
                        history[common_name]['Total Bytes Sent'] += bytes_sent
                        history[common_name]['Last Disconnection Time'] = disconnect_time  # Обновляем время отключения
                    except ValueError:
                        continue
    except Exception as e:
        logging.error(f'Error reading connection history: {e}')

    return history

def get_system_metrics():
    """Получает метрики системы: RAM, диск, CPU и сеть."""
    ram = psutil.virtual_memory()
    disk = psutil.disk_usage('/')
    cpu = psutil.cpu_percent(interval=1)
    net = psutil.net_io_counters()

    return {
        'ram': {
            'total': ram.total,
            'available': ram.available,
            'used': ram.used,
            'percent': ram.percent
        },
        'disk': {
            'total': disk.total,
            'used': disk.used,
            'free': disk.free,
            'percent': disk.percent
        },
        'cpu': cpu,
        'network': {
            'bytes_sent': net.bytes_sent,
            'bytes_recv': net.bytes_recv
        }
    }

@app.route('/system_monitor')
def system_monitor():
    return render_template('index.html')

@app.route('/status')
def status():
    server_status = check_openvpn_service()
    clients = parse_openvpn_status_log()
    system_metrics = get_system_metrics()
    server_uptime = get_openvpn_uptime()

    return jsonify({
        'server_status': server_status,
        'clients': clients,
        'system_metrics': system_metrics,
        'server_uptime_seconds': server_uptime or 0
    })

@app.route('/connection_history')
def connection_history():
    history = get_connection_history()
    return jsonify(history)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)
