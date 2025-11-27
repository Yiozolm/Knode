#!/usr/bin/env python3
"""
Knode 主启动程序
"""

if __name__ == '__main__':
    from backend.app import app
    app.run(debug=True, host='0.0.0.0', port=5001)