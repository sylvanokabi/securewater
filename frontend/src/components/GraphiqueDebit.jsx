import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';

const GraphiqueDebit = ({ donnees }) => {
  return (
    <div style={styles.card}>
      <h3 style={styles.titre}>Évolution du Débit d'Eau en Direct (L/min)</h3>
      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <LineChart data={donnees} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="temps" stroke="#64748b" />
            <YAxis stroke="#64748b" unit=" L/m" />
            <Tooltip
              contentStyle={{ backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #cbd5e1' }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="debitPrincipal"
              name="Réservoir Principal"
              stroke="#0284c7"
              strokeWidth={3}
              dot={false}
              isAnimationActive={true}
            />
            <Line
              type="monotone"
              dataKey="debitEst"
              name="Réservoir Est"
              stroke="#16a34a"
              strokeWidth={2}
              dot={false}
            />
            <Line
              type="monotone"
              dataKey="debitSud"
              name="Réservoir Sud"
              stroke="#dc2626"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '10px',
    padding: '1.25rem',
    border: '1px solid #e2e8f0',
    boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
    marginTop: '2rem',
  },
  titre: {
    margin: '0 0 1rem 0',
    fontSize: '1.1rem',
    color: '#1e293b',
  },
};

export default GraphiqueDebit;