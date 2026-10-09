/**
 * SafarGo Customer Mobile - Real Peshawar Interactive Map Component
 * Renders authentic OpenStreetMap / CartoDB tiles with Peshawar bounding constraints,
 * Custom User "ME" avatar marker with emerald pulse ring, pickup/dest pins, and real OSRM polyline.
 * Cross-platform: Uses WebView on native iOS/Android and seamless iframe on Web.
 */

import React, { useRef, useEffect } from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Platform, Dimensions } from 'react-native';
import { WebView } from 'react-native-webview';
import { PESHAWAR_CENTER, PESHAWAR_MAP_CONFIG } from '../services/peshawarGeofence';
import { useAuthStore } from '../store/authStore';

const { height: screenHeight } = Dimensions.get('window');

interface LocationCoords {
  lat: number;
  lng: number;
  heading?: number;
}

interface MapViewProps {
  userLocation: LocationCoords | null;
  pickupLocation?: LocationCoords | null;
  destinationLocation?: LocationCoords | null;
  driverLocation?: LocationCoords | null;
  routeCoordinates?: Array<{ lat: number; lng: number }> | null;
  vehicleType?: string;
  height?: number;
  onCenterUser?: () => void;
  onMapReady?: () => void;
}

export function MapView({
  userLocation,
  pickupLocation,
  destinationLocation,
  driverLocation,
  routeCoordinates,
  vehicleType = 'BIKE',
  height = Math.round(screenHeight * 0.41),
  onCenterUser,
  onMapReady,
}: MapViewProps) {
  const webViewRef = useRef<any>(null);
  const user = useAuthStore((s) => s.user);

  const initialLat = pickupLocation?.lat || userLocation?.lat || PESHAWAR_CENTER.lat;
  const initialLng = pickupLocation?.lng || userLocation?.lng || PESHAWAR_CENTER.lng;

  // Prepare HTML document with Leaflet and CartoDB Voyager tiles
  const avatarUrl = user?.avatarUrl && !user.avatarUrl.includes('safargo-symbol') ? user.avatarUrl : '';
  const userInitial = (user?.fullName || user?.username || 'U').charAt(0).toUpperCase();

  const mapHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body, #map { width: 100%; height: 100%; overflow: hidden; background: #e2e8f0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    
    /* ME User Avatar Marker */
    .user-marker-container {
      position: relative;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .user-pulse {
      position: absolute;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: rgba(22, 163, 74, 0.25);
      animation: pulseAnim 2s infinite ease-out;
    }
    .user-avatar-circle {
      position: relative;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #16A34A;
      border: 2.5px solid #FFFFFF;
      box-shadow: 0 4px 10px rgba(22, 163, 74, 0.45);
      display: flex;
      align-items: center;
      justify-content: center;
      color: #FFFFFF;
      font-weight: 800;
      font-size: 13px;
      overflow: hidden;
      z-index: 2;
    }
    .user-avatar-circle img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .user-me-badge {
      position: absolute;
      bottom: -4px;
      background: #15803D;
      color: #FFFFFF;
      font-size: 8px;
      font-weight: 900;
      padding: 1px 4px;
      border-radius: 4px;
      border: 1px solid #FFFFFF;
      z-index: 3;
      letter-spacing: 0.5px;
    }
    @keyframes pulseAnim {
      0% { transform: scale(0.7); opacity: 0.9; }
      100% { transform: scale(1.4); opacity: 0; }
    }

    /* Pickup Pin */
    .pin-pickup {
      width: 28px;
      height: 28px;
      background: #16A34A;
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-pickup-inner {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
      border-radius: 50%;
    }

    /* Destination Pin */
    .pin-dest {
      width: 28px;
      height: 28px;
      background: #DC2626;
      border: 2.5px solid #FFFFFF;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      box-shadow: 0 4px 10px rgba(220,38,38,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pin-dest-inner {
      width: 10px;
      height: 10px;
      background: #FFFFFF;
      border-radius: 50%;
    }

    /* Driver Vehicle Pin */
    .pin-driver {
      width: 32px;
      height: 32px;
      background: #0F172A;
      border: 2px solid #16A34A;
      border-radius: 50%;
      box-shadow: 0 4px 8px rgba(0,0,0,0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    .leaflet-control-attribution {
      font-size: 8px !important;
      background: rgba(255,255,255,0.7) !important;
      padding: 1px 4px !important;
    }
  </style>
</head>
<body>
  <div id="map"></div>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <script>
    var map;
    var userMarker, pickupMarker, destMarker, driverMarker, routeLayer;

    // Peshawar Bounding limits
    var pshBounds = L.latLngBounds(
      L.latLng(${PESHAWAR_MAP_CONFIG.bounds[0][0]}, ${PESHAWAR_MAP_CONFIG.bounds[0][1]}),
      L.latLng(${PESHAWAR_MAP_CONFIG.bounds[1][0]}, ${PESHAWAR_MAP_CONFIG.bounds[1][1]})
    );

    // Initialize map
    map = L.map('map', {
      center: [${initialLat}, ${initialLng}],
      zoom: ${PESHAWAR_MAP_CONFIG.defaultZoom},
      minZoom: ${PESHAWAR_MAP_CONFIG.minZoom},
      maxZoom: ${PESHAWAR_MAP_CONFIG.maxZoom},
      maxBounds: pshBounds,
      maxBoundsViscosity: 0.9,
      zoomControl: false,
      attributionControl: true
    });

    // Real OpenStreetMap & CartoDB Voyager tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap &copy; CARTO'
    }).addTo(map);

    // ME User Marker Icon
    function createUserIcon() {
      var imgHtml = '${avatarUrl}' ? '<img src="${avatarUrl}" alt="ME"/>' : '${userInitial}';
      return L.divIcon({
        className: 'user-marker-leaflet',
        html: '<div class="user-marker-container"><div class="user-pulse"></div><div class="user-avatar-circle">' + imgHtml + '</div><div class="user-me-badge">ME</div></div>',
        iconSize: [44, 44],
        iconAnchor: [22, 22]
      });
    }

    // Custom Pins
    var pickupIcon = L.divIcon({
      className: 'pin-pickup-leaflet',
      html: '<div class="pin-pickup"><div class="pin-pickup-inner"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    var destIcon = L.divIcon({
      className: 'pin-dest-leaflet',
      html: '<div class="pin-dest"><div class="pin-dest-inner"></div></div>',
      iconSize: [28, 28],
      iconAnchor: [14, 28]
    });

    var driverIcon = L.divIcon({
      className: 'pin-driver-leaflet',
      html: '<div class="pin-driver">🚗</div>',
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });

    // Update markers and route
    function updateMapState(state) {
      // 1. User Position
      if (state.userLocation && state.userLocation.lat) {
        if (!userMarker) {
          userMarker = L.marker([state.userLocation.lat, state.userLocation.lng], { icon: createUserIcon() }).addTo(map);
        } else {
          userMarker.setLatLng([state.userLocation.lat, state.userLocation.lng]);
        }
      }

      // 2. Pickup
      if (state.pickupLocation && state.pickupLocation.lat) {
        if (!pickupMarker) {
          pickupMarker = L.marker([state.pickupLocation.lat, state.pickupLocation.lng], { icon: pickupIcon }).addTo(map);
        } else {
          pickupMarker.setLatLng([state.pickupLocation.lat, state.pickupLocation.lng]);
        }
      } else if (pickupMarker) {
        map.removeLayer(pickupMarker);
        pickupMarker = null;
      }

      // 3. Destination
      if (state.destinationLocation && state.destinationLocation.lat) {
        if (!destMarker) {
          destMarker = L.marker([state.destinationLocation.lat, state.destinationLocation.lng], { icon: destIcon }).addTo(map);
        } else {
          destMarker.setLatLng([state.destinationLocation.lat, state.destinationLocation.lng]);
        }
      } else if (destMarker) {
        map.removeLayer(destMarker);
        destMarker = null;
      }

      // 4. Route Polyline
      if (state.routeCoordinates && state.routeCoordinates.length > 1) {
        var latlngs = state.routeCoordinates.map(function(c) { return [c.lat, c.lng]; });
        if (routeLayer) {
          map.removeLayer(routeLayer);
        }
        routeLayer = L.polyline(latlngs, {
          color: '#16A34A',
          weight: 5,
          opacity: 0.9,
          lineJoin: 'round',
          lineCap: 'round'
        }).addTo(map);

        map.fitBounds(routeLayer.getBounds(), { padding: [35, 35] });
      } else if (routeLayer) {
        map.removeLayer(routeLayer);
        routeLayer = null;
      }
    }

    // Initial render call
    updateMapState(${JSON.stringify({
      userLocation,
      pickupLocation,
      destinationLocation,
      driverLocation,
      routeCoordinates,
    })});

    // Camera control messages from React Native
    window.addEventListener('message', function(event) {
      try {
        var msg = JSON.parse(event.data);
        if (msg.action === 'centerUser' && msg.lat && msg.lng) {
          map.flyTo([msg.lat, msg.lng], 15, { animate: true, duration: 0.8 });
        } else if (msg.action === 'updateState') {
          updateMapState(msg.state);
        } else if (msg.action === 'zoomIn') {
          map.zoomIn();
        } else if (msg.action === 'zoomOut') {
          map.zoomOut();
        }
      } catch(e) {}
    });

    document.addEventListener('message', function(event) {
      window.dispatchEvent(new MessageEvent('message', { data: event.data }));
    });
  </script>
</body>
</html>
  `;

  // Sync state changes with the running map
  useEffect(() => {
    if (webViewRef.current) {
      const payload = JSON.stringify({
        action: 'updateState',
        state: {
          userLocation,
          pickupLocation,
          destinationLocation,
          driverLocation,
          routeCoordinates,
        },
      });
      webViewRef.current.postMessage?.(payload);
    }
  }, [userLocation, pickupLocation, destinationLocation, routeCoordinates]);

  const handleCenterUser = () => {
    if (userLocation && webViewRef.current) {
      webViewRef.current.postMessage?.(
        JSON.stringify({
          action: 'centerUser',
          lat: userLocation.lat,
          lng: userLocation.lng,
        })
      );
    }
    onCenterUser?.();
  };

  const handleZoomIn = () => {
    webViewRef.current?.postMessage?.(JSON.stringify({ action: 'zoomIn' }));
  };

  const handleZoomOut = () => {
    webViewRef.current?.postMessage?.(JSON.stringify({ action: 'zoomOut' }));
  };

  return (
    <View style={[styles.container, { height }]}>
      {/* Real Interactive Map Canvas */}
      {Platform.OS === 'web' ? (
        // iframe for web compatibility
        <iframe
          srcDoc={mapHtml}
          style={{ width: '100%', height: '100%', border: 'none' } as any}
          onLoad={() => onMapReady?.()}
        />
      ) : (
        <WebView
          ref={webViewRef}
          originWhitelist={['*']}
          source={{ html: mapHtml }}
          style={styles.webView}
          scrollEnabled={false}
          bounces={false}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          onLoadEnd={() => onMapReady?.()}
        />
      )}

      {/* Floating Map Controls */}
      <View style={styles.floatingControls}>
        {/* My Location Button */}
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleCenterUser}
          activeOpacity={0.8}
          accessibilityLabel="Recenter to My Location"
        >
          <View style={styles.recenterOuter}>
            <View style={styles.recenterDot} />
          </View>
        </TouchableOpacity>

        {/* Zoom In/Out Buttons */}
        <View style={styles.zoomGroup}>
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomIn} activeOpacity={0.7}>
            <Text style={styles.zoomText}>+</Text>
          </TouchableOpacity>
          <View style={styles.zoomDivider} />
          <TouchableOpacity style={styles.zoomBtn} onPress={handleZoomOut} activeOpacity={0.7}>
            <Text style={styles.zoomText}>−</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Peshawar City Badge */}
      <View style={styles.peshawarBadge}>
        <View style={styles.liveGreenDot} />
        <Text style={styles.peshawarBadgeText}>Peshawar Service Area</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    backgroundColor: '#E2E8F0',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
      },
    }),
  },
  webView: {
    width: '100%',
    height: '100%',
    backgroundColor: '#E2E8F0',
  },
  floatingControls: {
    position: 'absolute',
    right: 14,
    bottom: 14,
    gap: 8,
    alignItems: 'center',
    zIndex: 10,
  },
  recenterButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  recenterOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#16A34A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recenterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#16A34A',
  },
  zoomGroup: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  zoomBtn: {
    width: 36,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
  },
  zoomText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    lineHeight: 20,
  },
  peshawarBadge: {
    position: 'absolute',
    top: 12,
    left: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DCFCE7',
    zIndex: 10,
  },
  liveGreenDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: '#16A34A',
  },
  peshawarBadgeText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#15803D',
    letterSpacing: 0.2,
  },
});
