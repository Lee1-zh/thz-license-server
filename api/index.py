# -*- coding: utf-8 -*-
from flask import Flask, request, jsonify
from datetime import datetime, timedelta

app = Flask(__name__)

# 简单的内存存储（实际应用应该用数据库）
LICENSES = {}


@app.route('/api/check', methods=['GET'])
def check_license():
    machine_code = request.args.get('machine_code', '').upper().strip()

    if not machine_code:
        return jsonify({"authorized": False, "message": "缺少机器码"}), 400

    license_info = LICENSES.get(machine_code)

    if not license_info:
        return jsonify({
            "authorized": False,
            "message": "机器码未注册，请联系管理员"
        })

    if not license_info.get('authorized'):
        return jsonify({
            "authorized": False,
            "message": "等待管理员授权"
        })

    # 检查过期时间
    expire_time = license_info.get('expire_time')
    if expire_time:
        expire_dt = datetime.fromisoformat(expire_time)
        if datetime.now() > expire_dt:
            return jsonify({
                "authorized": False,
                "message": "授权已过期"
            })

    return jsonify({
        "authorized": True,
        "message": "授权有效",
        "expire_time": expire_time,
        "client_name": license_info.get('client_name', '')
    })


@app.route('/api/activate', methods=['POST'])
def activate_license():
    data = request.get_json()
    machine_code = data.get('machine_code', '').upper().strip()
    admin_key = data.get('admin_key', '')

    if admin_key != "ttthhhzzz":
        return jsonify({"success": False, "message": "无效的管理员密钥"}), 403

    LICENSES[machine_code] = {
        "authorized": True,
        "client_name": data.get('client_name', ''),
        "expire_time": (datetime.now() + timedelta(days=365)).isoformat(),
        "activated_at": datetime.now().isoformat()
    }

    return jsonify({"success": True, "message": "激活成功"})


@app.route('/api/revoke', methods=['POST'])
def revoke_license():
    data = request.get_json()
    machine_code = data.get('machine_code', '').upper().strip()

    if machine_code in LICENSES:
        LICENSES[machine_code]['authorized'] = False
        return jsonify({"success": True, "message": "授权已撤销"})

    return jsonify({"success": False, "message": "机器码不存在"})


@app.route('/api/list', methods=['GET'])
def list_licenses():
    admin_key = request.args.get('admin_key', '')
    if admin_key != "ttthhhzzz":
        return jsonify({"success": False, "message": "无效的管理员密钥"}), 403

    return jsonify({
        "success": True,
        "licenses": LICENSES
    })