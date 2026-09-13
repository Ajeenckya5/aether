package app.aether.band

import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationChannelCompat
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat

class KeepAliveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = NotificationManagerCompat.from(this)
    manager.createNotificationChannel(
      NotificationChannelCompat.Builder(CHANNEL, NotificationManagerCompat.IMPORTANCE_LOW)
        .setName("Aether band")
        .setDescription("Keeps the public Heart Rate link alive overnight.")
        .build(),
    )
    val notice = NotificationCompat.Builder(this, CHANNEL)
      .setContentTitle("Aether")
      .setContentText("Public Heart Rate is connected. Leave this on overnight for Aether sleep.")
      .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
      .setOngoing(true)
      .build()
    if (Build.VERSION.SDK_INT >= 34) {
      ServiceCompat.startForeground(
        this,
        7,
        notice,
        ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,
      )
    } else {
      startForeground(7, notice)
    }
    return START_STICKY
  }

  companion object {
    private const val CHANNEL = "aether-ble"
  }
}
