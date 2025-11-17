# phx_price_terminal.py
# Professional Trading Terminal - PHX Price Analysis (Enhanced)

import json
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from datetime import datetime
import numpy as np
import os
import pandas as pd
from matplotlib.gridspec import GridSpec
import matplotlib.ticker as ticker
from scipy.interpolate import make_interp_spline
from matplotlib.widgets import RectangleSelector

class ProfessionalPHXAnalyzer:
    def __init__(self, data_file="phx_price.json"):
        self.data_file = data_file
        self.price_data = None
        self.price_history = []
        self.timestamps = []
        self.colors = {
            'background': '#0A0A0A',
            'panel': '#1A1A1A',
            'text': '#E8E8E8',
            'text_secondary': '#888888',
            'positive': '#00FF88',
            'negative': '#FF4444',
            'warning': '#FFB800',
            'price_line': '#00D9FF',
            'grid': '#2A2A2A',
            'accent': '#8B5CF6'
        }
        
    def parse_timestamp(self, timestamp_str):
        """Parse timestamp with AM/PM format"""
        try:
            return datetime.strptime(timestamp_str, '%m/%d/%Y, %I:%M:%S %p')
        except ValueError:
            try:
                return datetime.strptime(timestamp_str, '%m/%d/%Y, %H:%M:%S')
            except ValueError:
                print(f"WARNING: Could not parse timestamp: {timestamp_str}")
                return datetime.now()
        
    def load_data(self):
        """Load price data from JSON file"""
        try:
            if not os.path.exists(self.data_file):
                print(f"DATA FILE '{self.data_file}' NOT FOUND.")
                print("PLEASE ENSURE PHX WALLET OR CENTRAL BANK HAS BEEN RUN FIRST.")
                return False
                
            with open(self.data_file, 'r') as f:
                self.price_data = json.load(f)
                
            self.price_history = []
            self.timestamps = []
            
            for entry in self.price_data.get('priceHistory', []):
                self.price_history.append(entry['price'])
                self.timestamps.append(self.parse_timestamp(entry['timestamp']))
            
            print(f"LOADED {len(self.price_history)} PRICE POINTS")
            return True
            
        except Exception as e:
            print(f"ERROR LOADING DATA: {e}")
            return False
    
    def smooth_data(self, x, y, smoothing_factor=300):
        """Create smooth interpolated curve"""
        if len(x) < 4:
            return x, y
        
        try:
            # Convert datetime to numeric for interpolation
            x_numeric = mdates.date2num(x)
            
            # Create smooth curve
            x_smooth = np.linspace(x_numeric.min(), x_numeric.max(), smoothing_factor)
            spl = make_interp_spline(x_numeric, y, k=min(3, len(x)-1))
            y_smooth = spl(x_smooth)
            
            # Convert back to datetime
            x_smooth_dates = mdates.num2date(x_smooth)
            
            return x_smooth_dates, y_smooth
        except:
            return x, y
    
    def _enable_zoom(self, ax, fig):
        """Enable scroll wheel zoom and click-drag pan"""
        # Store original limits
        ax._original_xlim = ax.get_xlim()
        ax._original_ylim = ax.get_ylim()
        ax._pan_start = None
        
        def on_scroll(event):
            """Handle scroll wheel zoom"""
            if event.inaxes != ax:
                return
            
            # Get current axis limits
            cur_xlim = ax.get_xlim()
            cur_ylim = ax.get_ylim()
            
            # Get event location
            xdata = event.xdata
            ydata = event.ydata
            
            if xdata is None or ydata is None:
                return
            
            # Zoom factor
            zoom_factor = 1.2 if event.button == 'down' else 0.8
            
            # Calculate new limits
            x_range = (cur_xlim[1] - cur_xlim[0]) * zoom_factor
            y_range = (cur_ylim[1] - cur_ylim[0]) * zoom_factor
            
            # Center zoom on mouse position
            x_ratio = (xdata - cur_xlim[0]) / (cur_xlim[1] - cur_xlim[0])
            y_ratio = (ydata - cur_ylim[0]) / (cur_ylim[1] - cur_ylim[0])
            
            new_xlim = [xdata - x_range * x_ratio, xdata + x_range * (1 - x_ratio)]
            new_ylim = [ydata - y_range * y_ratio, ydata + y_range * (1 - y_ratio)]
            
            ax.set_xlim(new_xlim)
            ax.set_ylim(new_ylim)
            fig.canvas.draw_idle()
        
        def on_press(event):
            """Handle mouse button press"""
            if event.inaxes != ax:
                return
            
            # Right-click for pan
            if event.button == 3:
                ax._pan_start = (event.xdata, event.ydata)
            # Double-click to reset
            elif event.dblclick:
                ax.set_xlim(ax._original_xlim)
                ax.set_ylim(ax._original_ylim)
                fig.canvas.draw_idle()
        
        def on_motion(event):
            """Handle mouse motion for panning"""
            if ax._pan_start is None or event.inaxes != ax:
                return
            
            dx = event.xdata - ax._pan_start[0]
            dy = event.ydata - ax._pan_start[1]
            
            cur_xlim = ax.get_xlim()
            cur_ylim = ax.get_ylim()
            
            ax.set_xlim([cur_xlim[0] - dx, cur_xlim[1] - dx])
            ax.set_ylim([cur_ylim[0] - dy, cur_ylim[1] - dy])
            
            fig.canvas.draw_idle()
        
        def on_release(event):
            """Handle mouse button release"""
            ax._pan_start = None
        
        # Connect events
        fig.canvas.mpl_connect('scroll_event', on_scroll)
        fig.canvas.mpl_connect('button_press_event', on_press)
        fig.canvas.mpl_connect('motion_notify_event', on_motion)
        fig.canvas.mpl_connect('button_release_event', on_release)
    
    def get_statistics(self):
        """Calculate comprehensive price statistics"""
        if not self.price_history:
            return None
            
        prices = np.array(self.price_history)
        
        if len(prices) > 1:
            returns = np.diff(prices) / prices[:-1] * 100
            volatility = np.std(returns) if len(returns) > 0 else 0
            day_change = prices[-1] - prices[-2]
            day_change_pct = (day_change / prices[-2] * 100) if prices[-2] != 0 else 0
        else:
            returns = np.array([0])
            volatility = 0
            day_change = 0
            day_change_pct = 0
        
        stats = {
            'current_price': prices[-1] if len(prices) > 0 else 0,
            'open_price': prices[0] if len(prices) > 0 else 0,
            'high_price': np.max(prices) if len(prices) > 0 else 0,
            'low_price': np.min(prices) if len(prices) > 0 else 0,
            'average_price': np.mean(prices) if len(prices) > 0 else 0,
            'std_dev': np.std(prices) if len(prices) > 0 else 0,
            'volatility': volatility,
            'total_return': ((prices[-1] - prices[0]) / prices[0] * 100) if len(prices) > 1 and prices[0] != 0 else 0,
            'day_change': day_change,
            'day_change_pct': day_change_pct,
            'total_points': len(prices),
            'variance': np.var(prices) if len(prices) > 0 else 0
        }
        return stats
    
    def print_terminal_header(self):
        """Print professional terminal header"""
        print("\n" + "=" * 80)
        print("PHX/USD PRICE ANALYSIS".center(80))
        print("PROFESSIONAL TRADING TERMINAL".center(80))
        print("=" * 80)
    
    def print_market_summary(self):
        """Print market summary in professional format"""
        if not self.price_history:
            print("NO DATA AVAILABLE")
            return
            
        stats = self.get_statistics()
        current_time = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        print(f"\nMARKET SUMMARY AS OF {current_time}")
        print("-" * 80)
        
        change_symbol = '+' if stats['day_change'] >= 0 else ''
        
        print(f"LAST PRICE: ${stats['current_price']:8.2f}   "
              f"CHANGE: {change_symbol}{stats['day_change']:7.2f}   "
              f"CHANGE %: {change_symbol}{stats['day_change_pct']:6.2f}%")
        
        print(f"OPEN:      ${stats['open_price']:8.2f}   "
              f"HIGH:     ${stats['high_price']:8.2f}   "
              f"LOW:      ${stats['low_price']:8.2f}")
        
        print(f"MEAN:      ${stats['average_price']:8.2f}   "
              f"STD DEV:  ${stats['std_dev']:8.2f}   "
              f"VOLATILITY: {stats['volatility']:6.2f}%")
        
        total_return_symbol = '+' if stats['total_return'] >= 0 else ''
        
        print(f"TOTAL RETURN: {total_return_symbol}{stats['total_return']:6.2f}%   "
              f"DATA POINTS: {stats['total_points']:4d}   "
              f"BASE PEG: $100.00")
        
        print("-" * 80)
    
    def create_main_chart(self):
        """Create professional trading terminal chart with zoom"""
        if len(self.price_history) < 2:
            print("INSUFFICIENT DATA FOR CHART ANALYSIS")
            return
            
        plt.style.use('dark_background')
        fig = plt.figure(figsize=(18, 10), facecolor=self.colors['background'])
        gs = GridSpec(3, 2, figure=fig, hspace=0.35, wspace=0.25)
        
        # Main price chart
        ax1 = fig.add_subplot(gs[0:2, :])
        self._create_price_chart(ax1)
        
        # Statistics panel
        ax2 = fig.add_subplot(gs[2, 0])
        self._create_statistics_panel(ax2)
        
        # Distribution panel
        ax3 = fig.add_subplot(gs[2, 1])
        self._create_distribution_panel(ax3)
        
        # Add zoom instructions
        fig.text(0.5, 0.02, 'INTERACTIVE ZOOM: Scroll to zoom • Right-click drag to pan • Double-click to reset', 
                ha='center', fontsize=9, color=self.colors['text_secondary'], 
                style='italic', alpha=0.7)
        
        # Enable interactive zoom
        self._enable_zoom(ax1, fig)
        self._enable_zoom(ax3, fig)
        
        plt.tight_layout(rect=[0, 0.03, 1, 1])
        plt.show()
    
    def _create_price_chart(self, ax):
        """Create main price chart with smooth curves"""
        prices = np.array(self.price_history)
        
        # Smooth the price line
        x_smooth, y_smooth = self.smooth_data(self.timestamps, prices)
        
        # Plot smooth price line with gradient effect
        ax.plot(x_smooth, y_smooth, 
                linewidth=2.5, color=self.colors['price_line'], 
                label='PHX/USD', alpha=0.9, zorder=3)
        
        # Add subtle fill under curve
        ax.fill_between(x_smooth, y_smooth, alpha=0.1, 
                       color=self.colors['price_line'], zorder=1)
        
        # Add base price line
        ax.axhline(y=100, color=self.colors['text_secondary'], 
                  linestyle='--', alpha=0.4, linewidth=1.5, 
                  label='BASE PEG', zorder=2)
        
        # Add moving averages with smooth curves
        if len(prices) > 5:
            ma5 = pd.Series(prices).rolling(window=min(5, len(prices))).mean()
            ma5_smooth_x, ma5_smooth_y = self.smooth_data(self.timestamps, ma5)
            ax.plot(ma5_smooth_x, ma5_smooth_y, color='#00FF88', 
                   linewidth=1.5, alpha=0.6, label='MA5', zorder=2)
        
        if len(prices) > 10:
            ma10 = pd.Series(prices).rolling(window=min(10, len(prices))).mean()
            ma10_smooth_x, ma10_smooth_y = self.smooth_data(self.timestamps, ma10)
            ax.plot(ma10_smooth_x, ma10_smooth_y, color='#8B5CF6', 
                   linewidth=1.5, alpha=0.6, label='MA10', zorder=2)
        
        # Minimalist styling
        ax.set_facecolor(self.colors['panel'])
        ax.set_title('PHX/USD', 
                    color=self.colors['text'], fontsize=16, 
                    fontweight='300', pad=20, loc='left')
        ax.set_ylabel('PRICE', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=10)
        
        # Subtle grid
        ax.grid(True, color=self.colors['grid'], alpha=0.2, 
               linestyle='-', linewidth=0.5)
        
        # Clean borders
        for spine in ax.spines.values():
            spine.set_color(self.colors['grid'])
            spine.set_linewidth(0.5)
        
        # Minimalist legend
        legend = ax.legend(facecolor=self.colors['panel'], 
                          edgecolor='none', loc='upper left', 
                          fontsize=9, framealpha=0.8)
        for text in legend.get_texts():
            text.set_color(self.colors['text_secondary'])
        
        # Format axes
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d %H:%M'))
        ax.xaxis.set_major_locator(mdates.AutoDateLocator())
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right',
                fontsize=8, color=self.colors['text_secondary'])
        plt.setp(ax.yaxis.get_majorticklabels(), fontsize=9,
                color=self.colors['text_secondary'])
        
        ax.yaxis.set_major_formatter(ticker.StrMethodFormatter('${x:.0f}'))
    
    def _create_statistics_panel(self, ax):
        """Create minimalist statistics panel"""
        stats = self.get_statistics()
        ax.axis('off')
        
        stats_data = [
            ("LAST", f"${stats['current_price']:.2f}", 
             self.colors['positive'] if stats['day_change'] >= 0 else self.colors['negative']),
            ("HIGH", f"${stats['high_price']:.2f}", self.colors['text']),
            ("LOW", f"${stats['low_price']:.2f}", self.colors['text']),
            ("MEAN", f"${stats['average_price']:.2f}", self.colors['text_secondary']),
            ("VOLATILITY", f"{stats['volatility']:.2f}%", self.colors['warning']),
            ("RETURN", f"{stats['total_return']:+.2f}%", 
             self.colors['positive'] if stats['total_return'] >= 0 else self.colors['negative']),
        ]
        
        y_position = 0.9
        for label, value, color in stats_data:
            ax.text(0.1, y_position, label, transform=ax.transAxes,
                   fontfamily='monospace', fontsize=9, 
                   color=self.colors['text_secondary'],
                   verticalalignment='top', fontweight='300')
            ax.text(0.95, y_position, value, transform=ax.transAxes,
                   fontfamily='monospace', fontsize=10, color=color,
                   verticalalignment='top', fontweight='500',
                   horizontalalignment='right')
            y_position -= 0.15
    
    def _create_distribution_panel(self, ax):
        """Create minimalist distribution panel"""
        prices = np.array(self.price_history)
        
        # Create smooth histogram
        n, bins, patches = ax.hist(prices, bins=20, alpha=0.6, 
                                  color=self.colors['price_line'], 
                                  edgecolor='none')
        
        # Gradient effect on bars
        for i, patch in enumerate(patches):
            patch.set_alpha(0.4 + (i / len(patches)) * 0.4)
        
        mean_price = np.mean(prices)
        ax.axvline(mean_price, color=self.colors['accent'], 
                  linestyle='--', linewidth=1.5, alpha=0.7,
                  label=f'MEAN ${mean_price:.1f}')
        
        ax.axvline(100, color=self.colors['text_secondary'], 
                  linestyle='--', alpha=0.3, linewidth=1.5,
                  label='BASE PEG')
        
        ax.set_facecolor(self.colors['panel'])
        ax.set_title('DISTRIBUTION', color=self.colors['text'], 
                    fontsize=12, fontweight='300', pad=10, loc='left')
        ax.set_xlabel('PRICE', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=9)
        ax.set_ylabel('FREQUENCY', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=9)
        
        ax.grid(True, color=self.colors['grid'], alpha=0.2, linewidth=0.5)
        
        for spine in ax.spines.values():
            spine.set_color(self.colors['grid'])
            spine.set_linewidth(0.5)
        
        legend = ax.legend(facecolor=self.colors['panel'], 
                          edgecolor='none', fontsize=8, 
                          loc='upper right', framealpha=0.8)
        for text in legend.get_texts():
            text.set_color(self.colors['text_secondary'])
        
        plt.setp(ax.xaxis.get_majorticklabels(), fontsize=8,
                color=self.colors['text_secondary'])
        plt.setp(ax.yaxis.get_majorticklabels(), fontsize=8,
                color=self.colors['text_secondary'])
    
    def create_technical_analysis(self):
        """Create technical analysis with zoom capability"""
        if len(self.price_history) < 2:
            print("INSUFFICIENT DATA FOR TECHNICAL ANALYSIS")
            return
            
        plt.style.use('dark_background')
        fig, (ax1, ax2) = plt.subplots(2, 1, figsize=(18, 12), 
                                      facecolor=self.colors['background'])
        
        prices = np.array(self.price_history)
        
        self._create_technical_indicators(ax1, prices)
        self._create_returns_volume_chart(ax2, prices)
        
        fig.text(0.5, 0.02, 'INTERACTIVE ZOOM: Scroll to zoom • Right-click drag to pan • Double-click to reset', 
                ha='center', fontsize=9, color=self.colors['text_secondary'], 
                style='italic', alpha=0.7)
        
        # Enable zoom on both charts
        self._enable_zoom(ax1, fig)
        self._enable_zoom(ax2, fig)
        
        plt.tight_layout(rect=[0, 0.03, 1, 1])
        plt.show()
    
    def _create_technical_indicators(self, ax, prices):
        """Create smooth technical indicators"""
        x_smooth, y_smooth = self.smooth_data(self.timestamps, prices)
        
        ax.plot(x_smooth, y_smooth, linewidth=2.5, 
               color=self.colors['price_line'], label='PHX/USD', alpha=0.9)
        
        ax.fill_between(x_smooth, y_smooth, alpha=0.08, 
                       color=self.colors['price_line'])
        
        if len(prices) > 10:
            window = min(20, len(prices))
            rolling_mean = pd.Series(prices).rolling(window=window).mean()
            rolling_std = pd.Series(prices).rolling(window=window).std()
            
            upper_band = rolling_mean + (rolling_std * 2)
            lower_band = rolling_mean - (rolling_std * 2)
            
            # Smooth bollinger bands
            valid_idx = window-1
            upper_smooth_x, upper_smooth_y = self.smooth_data(
                self.timestamps[valid_idx:], upper_band[valid_idx:])
            lower_smooth_x, lower_smooth_y = self.smooth_data(
                self.timestamps[valid_idx:], lower_band[valid_idx:])
            ma_smooth_x, ma_smooth_y = self.smooth_data(
                self.timestamps[valid_idx:], rolling_mean[valid_idx:])
            
            ax.fill_between(upper_smooth_x, lower_smooth_y, upper_smooth_y, 
                           alpha=0.1, color=self.colors['accent'])
            
            ax.plot(ma_smooth_x, ma_smooth_y, color=self.colors['accent'], 
                   linewidth=1.5, alpha=0.6, label=f'MA{window}')
        
        ax.axhline(y=100, color=self.colors['text_secondary'], 
                  linestyle='--', alpha=0.3, linewidth=1.5, label='BASE PEG')
        
        ax.set_facecolor(self.colors['panel'])
        ax.set_title('TECHNICAL ANALYSIS', color=self.colors['text'], 
                    fontsize=16, fontweight='300', pad=20, loc='left')
        ax.set_ylabel('PRICE', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=10)
        
        ax.grid(True, color=self.colors['grid'], alpha=0.2, linewidth=0.5)
        
        for spine in ax.spines.values():
            spine.set_color(self.colors['grid'])
            spine.set_linewidth(0.5)
        
        legend = ax.legend(facecolor=self.colors['panel'], 
                          edgecolor='none', fontsize=9, framealpha=0.8)
        for text in legend.get_texts():
            text.set_color(self.colors['text_secondary'])
        
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
        plt.setp(ax.xaxis.get_majorticklabels(), fontsize=8,
                color=self.colors['text_secondary'])
        plt.setp(ax.yaxis.get_majorticklabels(), fontsize=9,
                color=self.colors['text_secondary'])
    
    def _create_returns_volume_chart(self, ax, prices):
        """Create smooth returns chart"""
        if len(prices) > 1:
            returns = np.diff(prices) / prices[:-1] * 100
            return_dates = self.timestamps[1:]
            
            colors = [self.colors['positive'] if x >= 0 else self.colors['negative'] 
                     for x in returns]
            
            bars = ax.bar(return_dates, returns, color=colors, 
                         alpha=0.7, width=0.8, edgecolor='none')
            
            # Gradient effect
            for i, bar in enumerate(bars):
                bar.set_alpha(0.5 + abs(returns[i]) / (max(abs(returns)) * 2))
            
            ax.axhline(y=0, color=self.colors['text_secondary'], 
                      linewidth=1, alpha=0.5)
        
        ax.set_facecolor(self.colors['panel'])
        ax.set_title('RETURNS', color=self.colors['text'], 
                    fontsize=14, fontweight='300', pad=15, loc='left')
        ax.set_ylabel('RETURN %', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=10)
        ax.set_xlabel('DATE', color=self.colors['text_secondary'], 
                     fontweight='300', fontsize=10)
        
        ax.grid(True, color=self.colors['grid'], alpha=0.2, linewidth=0.5, axis='y')
        
        for spine in ax.spines.values():
            spine.set_color(self.colors['grid'])
            spine.set_linewidth(0.5)
        
        ax.xaxis.set_major_formatter(mdates.DateFormatter('%m/%d'))
        plt.setp(ax.xaxis.get_majorticklabels(), rotation=45, ha='right',
                fontsize=8, color=self.colors['text_secondary'])
        plt.setp(ax.yaxis.get_majorticklabels(), fontsize=8,
                color=self.colors['text_secondary'])
    
    def run_terminal(self):
        """Main terminal interface"""
        if not self.load_data():
            return
            
        while True:
            self.print_terminal_header()
            self.print_market_summary()
            
            print("\nANALYSIS OPTIONS:")
            print("1. MAIN CHART (Interactive Zoom)")
            print("2. TECHNICAL ANALYSIS (Interactive Zoom)")
            print("3. REFRESH DATA")
            print("4. EXIT")
            print("-" * 80)
            
            choice = input("SELECT OPTION (1-4): ").strip()
            
            if choice == '1':
                print("\nLOADING CHART... (Use scroll wheel to zoom, right-click to pan)")
                self.create_main_chart()
            elif choice == '2':
                print("\nLOADING TECHNICAL ANALYSIS... (Use scroll wheel to zoom)")
                self.create_technical_analysis()
            elif choice == '3':
                if not self.load_data():
                    print("FAILED TO REFRESH DATA")
            elif choice == '4':
                print("EXITING TERMINAL")
                break
            else:
                print("INVALID OPTION. PLEASE SELECT 1-4.")

def main():
    """Main function"""
    analyzer = ProfessionalPHXAnalyzer()
    analyzer.run_terminal()

if __name__ == "__main__":
    main()