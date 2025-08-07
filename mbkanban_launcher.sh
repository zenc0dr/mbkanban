#!/bin/bash

# MBKanban Launcher
# Идемпотентный скрипт для управления сервером MBKanban

set -e

# Конфигурация
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_NAME="MBKanban"
SERVER_FILE="server.js"
PORT="8823"
PID_FILE="$SCRIPT_DIR/mbkanban.pid"
LOG_FILE="$SCRIPT_DIR/mbkanban.log"
NODE_BIN="node"

# Цвета для вывода
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Функция для вывода справки
show_help() {
    echo -e "${BLUE}MBKanban Launcher${NC}"
    echo ""
    echo "Использование: $0 [команда]"
    echo ""
    echo "Команды:"
    echo "  start     - Запустить сервер MBKanban"
    echo "  stop      - Остановить сервер MBKanban"
    echo "  restart   - Перезапустить сервер MBKanban"
    echo "  status    - Показать статус сервера"
    echo "  logs      - Показать логи сервера"
    echo "  health    - Проверить здоровье сервера"
    echo "  help      - Показать эту справку"
    echo ""
    echo "Примеры:"
    echo "  $0 start    # Запустить сервер"
    echo "  $0 status   # Проверить статус"
    echo "  $0 stop     # Остановить сервер"
    echo ""
    echo "Порт: $PORT"
    echo "URL: http://localhost:$PORT"
}

# Функция для проверки, запущен ли сервер
is_server_running() {
    if [ -f "$PID_FILE" ]; then
        local pid=$(cat "$PID_FILE")
        if ps -p "$pid" > /dev/null 2>&1; then
            return 0
        else
            # PID файл есть, но процесс не существует
            rm -f "$PID_FILE"
            return 1
        fi
    else
        return 1
    fi
}

# Функция для получения PID сервера
get_server_pid() {
    if is_server_running; then
        cat "$PID_FILE"
    else
        echo ""
    fi
}

# Функция для запуска сервера
start_server() {
    echo -e "${BLUE}🚀 Запуск $PROJECT_NAME...${NC}"
    
    if is_server_running; then
        local pid=$(get_server_pid)
        echo -e "${YELLOW}⚠️  Сервер уже запущен (PID: $pid)${NC}"
        return 0
    fi
    
    # Проверяем, что мы в правильной директории
    if [ ! -f "$SERVER_FILE" ]; then
        echo -e "${RED}❌ Ошибка: $SERVER_FILE не найден${NC}"
        echo "Убедитесь, что вы находитесь в директории проекта"
        return 1
    fi
    
    # Проверяем, что node установлен
    if ! command -v "$NODE_BIN" &> /dev/null; then
        echo -e "${RED}❌ Ошибка: $NODE_BIN не найден${NC}"
        return 1
    fi
    
    # Проверяем, что порт свободен
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "${RED}❌ Ошибка: Порт $PORT уже занят${NC}"
        return 1
    fi
    
    # Запускаем сервер в фоне
    echo -e "${CYAN}📝 Запуск сервера на порту $PORT...${NC}"
    
    nohup "$NODE_BIN" "$SERVER_FILE" > "$LOG_FILE" 2>&1 &
    local pid=$!
    
    # Сохраняем PID
    echo "$pid" > "$PID_FILE"
    
    # Ждем немного и проверяем, что сервер запустился
    sleep 2
    
    if is_server_running; then
        echo -e "${GREEN}✅ $PROJECT_NAME успешно запущен (PID: $pid)${NC}"
        echo -e "${GREEN}🌐 URL: http://localhost:$PORT${NC}"
        echo -e "${GREEN}📝 Логи: $LOG_FILE${NC}"
        return 0
    else
        echo -e "${RED}❌ Ошибка: Не удалось запустить сервер${NC}"
        rm -f "$PID_FILE"
        return 1
    fi
}

# Функция для остановки сервера
stop_server() {
    echo -e "${BLUE}🛑 Остановка $PROJECT_NAME...${NC}"
    
    if ! is_server_running; then
        echo -e "${YELLOW}⚠️  Сервер не запущен${NC}"
        return 0
    fi
    
    local pid=$(get_server_pid)
    echo -e "${CYAN}📝 Остановка процесса (PID: $pid)...${NC}"
    
    # Пытаемся остановить процесс gracefully
    kill "$pid" 2>/dev/null || true
    
    # Ждем до 10 секунд
    local count=0
    while [ $count -lt 10 ]; do
        if ! ps -p "$pid" > /dev/null 2>&1; then
            break
        fi
        sleep 1
        count=$((count + 1))
    done
    
    # Если процесс все еще жив, убиваем его принудительно
    if ps -p "$pid" > /dev/null 2>&1; then
        echo -e "${YELLOW}⚠️  Принудительная остановка процесса...${NC}"
        kill -9 "$pid" 2>/dev/null || true
    fi
    
    # Удаляем PID файл
    rm -f "$PID_FILE"
    
    echo -e "${GREEN}✅ $PROJECT_NAME остановлен${NC}"
    return 0
}

# Функция для перезапуска сервера
restart_server() {
    echo -e "${BLUE}🔄 Перезапуск $PROJECT_NAME...${NC}"
    
    stop_server
    sleep 1
    start_server
}

# Функция для показа статуса
show_status() {
    echo -e "${BLUE}📊 Статус $PROJECT_NAME${NC}"
    echo ""
    
    if is_server_running; then
        local pid=$(get_server_pid)
        echo -e "${GREEN}✅ Сервер запущен${NC}"
        echo -e "   PID: $pid"
        echo -e "   Порт: $PORT"
        echo -e "   URL: http://localhost:$PORT"
        echo -e "   Логи: $LOG_FILE"
        
        # Проверяем здоровье сервера
        if curl -s "http://localhost:$PORT/api/projects" > /dev/null 2>&1; then
            echo -e "   Здоровье: ${GREEN}✅ OK${NC}"
        else
            echo -e "   Здоровье: ${RED}❌ Ошибка${NC}"
        fi
        
        # Показываем статистику процессов
        echo ""
        echo -e "${CYAN}📈 Статистика процесса:${NC}"
        ps -p "$pid" -o pid,ppid,cmd,etime,pcpu,pmem --no-headers 2>/dev/null || echo "   Процесс не найден"
        
    else
        echo -e "${RED}❌ Сервер не запущен${NC}"
        echo -e "   PID файл: $PID_FILE"
        echo -e "   Логи: $LOG_FILE"
    fi
}

# Функция для показа логов
show_logs() {
    echo -e "${BLUE}📝 Логи $PROJECT_NAME${NC}"
    echo ""
    
    if [ -f "$LOG_FILE" ]; then
        if [ -s "$LOG_FILE" ]; then
            tail -n 50 "$LOG_FILE"
        else
            echo -e "${YELLOW}⚠️  Файл логов пуст${NC}"
        fi
    else
        echo -e "${RED}❌ Файл логов не найден: $LOG_FILE${NC}"
    fi
}

# Функция для проверки здоровья сервера
check_health() {
    echo -e "${BLUE}🏥 Проверка здоровья $PROJECT_NAME${NC}"
    echo ""
    
    if ! is_server_running; then
        echo -e "${RED}❌ Сервер не запущен${NC}"
        return 1
    fi
    
    local pid=$(get_server_pid)
    echo -e "📊 Процесс: ${GREEN}✅ Запущен (PID: $pid)${NC}"
    
    # Проверяем порт
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo -e "🌐 Порт $PORT: ${GREEN}✅ Открыт${NC}"
    else
        echo -e "🌐 Порт $PORT: ${RED}❌ Закрыт${NC}"
        return 1
    fi
    
    # Проверяем API
    if curl -s "http://localhost:$PORT/api/projects" > /dev/null 2>&1; then
        echo -e "🔌 API: ${GREEN}✅ Отвечает${NC}"
    else
        echo -e "🔌 API: ${RED}❌ Не отвечает${NC}"
        return 1
    fi
    
    # Проверяем веб-страницу
    if curl -s "http://localhost:$PORT/" | grep -q "MBKanban"; then
        echo -e "🌐 Веб-страница: ${GREEN}✅ Загружается${NC}"
    else
        echo -e "🌐 Веб-страница: ${RED}❌ Не загружается${NC}"
        return 1
    fi
    
    echo ""
    echo -e "${GREEN}✅ Все проверки пройдены успешно!${NC}"
    return 0
}

# Функция для очистки
cleanup() {
    echo -e "${BLUE}🧹 Очистка $PROJECT_NAME${NC}"
    
    stop_server
    
    # Удаляем файлы
    rm -f "$PID_FILE"
    rm -f "$LOG_FILE"
    
    echo -e "${GREEN}✅ Очистка завершена${NC}"
}

# Основная логика
case "${1:-help}" in
    "start")
        start_server
        ;;
    "stop")
        stop_server
        ;;
    "restart")
        restart_server
        ;;
    "status")
        show_status
        ;;
    "logs")
        show_logs
        ;;
    "health")
        check_health
        ;;
    "cleanup")
        cleanup
        ;;
    "help"|"-h"|"--help")
        show_help
        ;;
    *)
        echo -e "${RED}❌ Неизвестная команда: $1${NC}"
        echo "Используйте '$0 help' для справки"
        exit 1
        ;;
esac
