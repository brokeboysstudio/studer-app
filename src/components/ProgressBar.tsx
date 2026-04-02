import React from 'react'
import { View, StyleSheet } from 'react-native'

interface Props {
  step: number
  total: number
}

export default function ProgressBar({ step, total }: Props) {
  return (
    <View style={styles.track}>
      <View style={[styles.fill, { flex: step }]} />
      <View style={{ flex: total - step }} />
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    height: 2,
    backgroundColor: '#1A1A1A',
    flexDirection: 'row',
  },
  fill: {
    height: 2,
    backgroundColor: '#FFFFFF',
  },
})
