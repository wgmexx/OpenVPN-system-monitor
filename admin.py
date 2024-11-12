from flask import Flask, request, jsonify, render_template, send_from_directory
import subprocess
import logging
import os

app = Flask(__name__)
logging.basicConfig(level=logging.DEBUG)

OVPN_SCRIPT_PATH = "/root/ovpn.sh"
OVPN_DIR = "/root/"  # Директория с .ovpn файлами

def run_ovpn_script(user_input):
    """Запускает скрипт ovpn.sh с заданным вводом."""
    try:
        process = subprocess.Popen(
            ["sudo", OVPN_SCRIPT_PATH],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True
        )
        
        stdout, stderr = process.communicate(input=user_input, timeout=30)  # Тайм-аут 30 секунд
        logging.debug("Script output: %s", stdout)

        return {"status": "success", "output": stdout}
    except subprocess.TimeoutExpired:
        process.kill()
        return {"status": "error", "output": "Script timed out"}
    except subprocess.CalledProcessError as e:
        logging.error("Error running script: %s", e)
        return {"status": "error", "output": str(e)}

@app.route('/add_user', methods=['POST'])
def add_user():
    username = request.json.get("username")
    if not username:
        return jsonify({"status": "error", "message": "Username is required"}), 400

    user_input = f"1\n{username}\n1\n"  # 1 для добавления, имя пользователя и 1 для без пароля
    result = run_ovpn_script(user_input)

    # Упрощаем вывод для успешного добавления
    if result['status'] == 'success':
        return jsonify({"status": "success", "message": "Готово"})
    else:
        return jsonify({"status": "error", "message": result.get("output", "Произошла ошибка")})

@app.route('/add_user_page')  # Добавляем маршрут для страницы
def add_user_page():
    """Отображает страницу add_user.html."""
    return render_template('add_user.html')  # Используем render_template

@app.route('/list_users', methods=['GET'])
def list_users():
    """Список файлов .ovpn в каталоге /root."""
    try:
        ovpn_files = [f for f in os.listdir(OVPN_DIR) if f.endswith('.ovpn')]
        return jsonify({"status": "success", "files": ovpn_files})
    except Exception as e:
        return jsonify({"status": "error", "message": str(e)})

@app.route('/download/<filename>', methods=['GET'])
def download_file(filename):
    """Скачивание .ovpn файла."""
    try:
        file_path = os.path.join(OVPN_DIR, filename)
        if not os.path.isfile(file_path):
            return jsonify({"status": "error", "message": "File not found"}), 404
        return send_from_directory(OVPN_DIR, filename, as_attachment=True)
    except Exception as e:
        logging.error(f"Error downloading file {filename}: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
