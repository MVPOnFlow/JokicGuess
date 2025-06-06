from flask import Flask, render_template, request, jsonify, session
import os
import requests
import json
from datetime import datetime
import secrets

app = Flask(__name__)
app.secret_key = os.getenv('FLASK_SECRET_KEY', secrets.token_hex(16))

# Flow blockchain configuration
FLOW_CONFIG = {
    "accessNode": "https://rest-mainnet.onflow.org",
    "network": "mainnet",
    "walletconnect_project_id": "2f5a2c1b8e4d3a9c7f1e6b8d4a2c9e7f"
}

@app.route('/')
def index():
    return render_template('index.html', flow_config=FLOW_CONFIG)

@app.route('/api/connect-wallet', methods=['POST'])
def connect_wallet():
    """Handle wallet connection"""
    try:
        data = request.get_json()
        wallet_address = data.get('address')
        
        if not wallet_address:
            return jsonify({'error': 'No wallet address provided'}), 400
        
        # Store wallet address in session
        session['wallet_address'] = wallet_address
        session['connected'] = True
        
        return jsonify({
            'success': True,
            'address': wallet_address,
            'message': 'Wallet connected successfully'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/disconnect-wallet', methods=['POST'])
def disconnect_wallet():
    """Handle wallet disconnection"""
    session.clear()
    return jsonify({'success': True, 'message': 'Wallet disconnected'})

@app.route('/api/pet', methods=['POST'])
def pet_horse():
    """Handle horse petting - integrates with existing Discord bot logic"""
    try:
        if not session.get('connected'):
            return jsonify({'error': 'Please connect your wallet first'}), 401
        
        wallet_address = session.get('wallet_address')
        
        # Import the existing pet logic from your Discord bot
        from utils.helpers import custom_reward, get_basic_pet_response
        import sqlite3
        import psycopg2
        
        # Use the same database logic as your Discord bot
        DATABASE_URL = os.getenv('DATABASE_URL')
        
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL, sslmode='require')
            cursor = conn.cursor()
            db_type = 'postgresql'
        else:
            conn = sqlite3.connect('local.db')
            cursor = conn.cursor()
            db_type = 'sqlite'
        
        # Convert wallet address to a user_id equivalent
        user_id = hash(wallet_address) % (10**10)  # Convert address to numeric ID
        today = datetime.utcnow().strftime("%Y-%m-%d")
        
        # Check user's daily pets remaining
        if db_type == 'postgresql':
            query = "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = %s"
        else:
            query = "SELECT balance, daily_pets_remaining, last_pet_date FROM user_rewards WHERE user_id = ?"
        
        cursor.execute(query, (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data:
            # Initialize user
            if db_type == 'postgresql':
                query = "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (%s, %s, %s, %s)"
            else:
                query = "INSERT INTO user_rewards (user_id, balance, daily_pets_remaining, last_pet_date) VALUES (?, ?, ?, ?)"
            
            cursor.execute(query, (user_id, 0, 1, None))
            conn.commit()
            user_data = (0, 1, None)
        
        balance, daily_pets_remaining, last_pet_date = user_data
        
        # Reset pets if new day
        if last_pet_date != today:
            daily_pets_remaining += 1  # DEFAULT_FREE_DAILY_PETS
        
        if daily_pets_remaining <= 0:
            conn.close()
            return jsonify({
                'error': 'Hold your horses! You\'ve used all your pets for today! Try again tomorrow.',
                'pets_remaining': 0
            }), 400
        
        # Generate reward
        reward = custom_reward()
        new_balance = balance + reward
        new_daily_pets_remaining = daily_pets_remaining - 1
        
        # Update database
        if db_type == 'postgresql':
            query = "UPDATE user_rewards SET balance = %s, daily_pets_remaining = %s, last_pet_date = %s WHERE user_id = %s"
        else:
            query = "UPDATE user_rewards SET balance = ?, daily_pets_remaining = ?, last_pet_date = ? WHERE user_id = ?"
        
        cursor.execute(query, (new_balance, new_daily_pets_remaining, today, user_id))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'reward': reward,
            'new_balance': new_balance,
            'pets_remaining': new_daily_pets_remaining,
            'message': get_basic_pet_response(reward)
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/my-rewards', methods=['GET'])
def get_my_rewards():
    """Get user's current reward balance"""
    try:
        if not session.get('connected'):
            return jsonify({'error': 'Please connect your wallet first'}), 401
        
        wallet_address = session.get('wallet_address')
        user_id = hash(wallet_address) % (10**10)
        
        # Database connection
        DATABASE_URL = os.getenv('DATABASE_URL')
        
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL, sslmode='require')
            cursor = conn.cursor()
            query = "SELECT balance FROM user_rewards WHERE user_id = %s"
        else:
            conn = sqlite3.connect('local.db')
            cursor = conn.cursor()
            query = "SELECT balance FROM user_rewards WHERE user_id = ?"
        
        cursor.execute(query, (user_id,))
        user_data = cursor.fetchone()
        conn.close()
        
        balance = user_data[0] if user_data else 0
        
        return jsonify({
            'success': True,
            'balance': balance
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/claim-rewards', methods=['POST'])
def claim_rewards():
    """Claim accumulated rewards"""
    try:
        if not session.get('connected'):
            return jsonify({'error': 'Please connect your wallet first'}), 401
        
        wallet_address = session.get('wallet_address')
        user_id = hash(wallet_address) % (10**10)
        
        # Database connection
        DATABASE_URL = os.getenv('DATABASE_URL')
        
        if DATABASE_URL:
            conn = psycopg2.connect(DATABASE_URL, sslmode='require')
            cursor = conn.cursor()
            db_type = 'postgresql'
        else:
            conn = sqlite3.connect('local.db')
            cursor = conn.cursor()
            db_type = 'sqlite'
        
        # Get current balance
        if db_type == 'postgresql':
            query = "SELECT balance FROM user_rewards WHERE user_id = %s"
        else:
            query = "SELECT balance FROM user_rewards WHERE user_id = ?"
        
        cursor.execute(query, (user_id,))
        user_data = cursor.fetchone()
        
        if not user_data or user_data[0] < 1:
            conn.close()
            return jsonify({'error': 'You need at least 1 $MVP to claim.'}), 400
        
        balance = user_data[0]
        
        # Reset balance to 0
        if db_type == 'postgresql':
            query = "UPDATE user_rewards SET balance = 0 WHERE user_id = %s"
        else:
            query = "UPDATE user_rewards SET balance = 0 WHERE user_id = ?"
        
        cursor.execute(query, (user_id,))
        conn.commit()
        conn.close()
        
        return jsonify({
            'success': True,
            'claimed_amount': balance,
            'message': f'Successfully claimed {balance:.2f} $MVP!'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/fetch-jokic-moments', methods=['POST'])
def fetch_jokic_moments():
    """Fetch Jokic moments from user's Flow wallet"""
    try:
        if not session.get('connected'):
            return jsonify({'error': 'Please connect your wallet first'}), 401
        
        wallet_address = session.get('wallet_address')
        
        # This would integrate with Flow blockchain to fetch actual moments
        # For now, return mock data
        mock_moments = [
            {
                'id': '12345',
                'SerialNumber': '42',
                'TotalCirculation': '500',
                'PlayCategory': 'Rare',
                'PlayerFirstName': 'Nikola',
                'PlayerLastName': 'Jokic',
                'estimatedValue': 25
            },
            {
                'id': '67890',
                'SerialNumber': '156',
                'TotalCirculation': '1000',
                'PlayCategory': 'Common',
                'PlayerFirstName': 'Nikola',
                'PlayerLastName': 'Jokic',
                'estimatedValue': 15
            }
        ]
        
        return jsonify({
            'success': True,
            'moments': mock_moments
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/trade-moments', methods=['POST'])
def trade_moments():
    """Trade selected moments for MVP tokens"""
    try:
        if not session.get('connected'):
            return jsonify({'error': 'Please connect your wallet first'}), 401
        
        data = request.get_json()
        selected_moments = data.get('selected_moments', [])
        
        if not selected_moments:
            return jsonify({'error': 'No moments selected for trading'}), 400
        
        if len(selected_moments) > 50:
            return jsonify({'error': 'Cannot trade more than 50 moments at once'}), 400
        
        # Calculate total value (mock calculation)
        total_value = len(selected_moments) * 20  # Mock value
        mvp_reward = round(total_value * 1.15)
        
        # In a real implementation, this would interact with Flow blockchain
        # For now, simulate the trade
        
        return jsonify({
            'success': True,
            'moments_traded': len(selected_moments),
            'mvp_received': mvp_reward,
            'message': f'Successfully traded {len(selected_moments)} moments for {mvp_reward} $MVP!'
        })
    
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)