export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bitacora: {
        Row: {
          accion: string
          created_at: string
          detalle: string | null
          empleado_id: string | null
          empleado_nombre: string | null
          id: string
        }
        Insert: {
          accion: string
          created_at?: string
          detalle?: string | null
          empleado_id?: string | null
          empleado_nombre?: string | null
          id?: string
        }
        Update: {
          accion?: string
          created_at?: string
          detalle?: string | null
          empleado_id?: string | null
          empleado_nombre?: string | null
          id?: string
        }
        Relationships: []
      }
      caja_fondos: {
        Row: {
          fecha: string
          monto: number
        }
        Insert: {
          fecha: string
          monto?: number
        }
        Update: {
          fecha?: string
          monto?: number
        }
        Relationships: []
      }
      comanda_items: {
        Row: {
          cantidad: number
          comanda_id: string
          estacion: string
          id: string
          modificadores: Json
          nombre: string
          notas: string | null
          precio_unitario: number
          producto_id: string
        }
        Insert: {
          cantidad?: number
          comanda_id: string
          estacion?: string
          id?: string
          modificadores?: Json
          nombre: string
          notas?: string | null
          precio_unitario: number
          producto_id: string
        }
        Update: {
          cantidad?: number
          comanda_id?: string
          estacion?: string
          id?: string
          modificadores?: Json
          nombre?: string
          notas?: string | null
          precio_unitario?: number
          producto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comanda_items_comanda_id_fkey"
            columns: ["comanda_id"]
            isOneToOne: false
            referencedRelation: "comandas"
            referencedColumns: ["id"]
          },
        ]
      }
      comandas: {
        Row: {
          client_token: string
          created_at: string
          cuenta_id: string
          estado: string
          id: string
          mesa_id: string
          mesero: string | null
          numero: number
        }
        Insert: {
          client_token: string
          created_at?: string
          cuenta_id: string
          estado?: string
          id?: string
          mesa_id: string
          mesero?: string | null
          numero?: number
        }
        Update: {
          client_token?: string
          created_at?: string
          cuenta_id?: string
          estado?: string
          id?: string
          mesa_id?: string
          mesero?: string | null
          numero?: number
        }
        Relationships: [
          {
            foreignKeyName: "comandas_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comandas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      cuentas: {
        Row: {
          abierta_at: string
          cerrada_at: string | null
          estado: string
          fecha_operativa: string | null
          id: string
          mesa_id: string
          metodo_pago: string | null
          motivo_anulacion: string | null
          propina: number
          total: number | null
        }
        Insert: {
          abierta_at?: string
          cerrada_at?: string | null
          estado?: string
          fecha_operativa?: string | null
          id?: string
          mesa_id: string
          metodo_pago?: string | null
          motivo_anulacion?: string | null
          propina?: number
          total?: number | null
        }
        Update: {
          abierta_at?: string
          cerrada_at?: string | null
          estado?: string
          fecha_operativa?: string | null
          id?: string
          mesa_id?: string
          metodo_pago?: string | null
          motivo_anulacion?: string | null
          propina?: number
          total?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "cuentas_mesa_id_fkey"
            columns: ["mesa_id"]
            isOneToOne: false
            referencedRelation: "mesas"
            referencedColumns: ["id"]
          },
        ]
      }
      empleados: {
        Row: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          pin_hash: string
          rol: string
        }
        Insert: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre: string
          pin_hash: string
          rol: string
        }
        Update: {
          activo?: boolean
          created_at?: string
          id?: string
          nombre?: string
          pin_hash?: string
          rol?: string
        }
        Relationships: []
      }
      mesas: {
        Row: {
          activo: boolean
          created_at: string
          estado: string
          id: string
          nombre: string
          orden: number
        }
        Insert: {
          activo?: boolean
          created_at?: string
          estado?: string
          id?: string
          nombre: string
          orden?: number
        }
        Update: {
          activo?: boolean
          created_at?: string
          estado?: string
          id?: string
          nombre?: string
          orden?: number
        }
        Relationships: []
      }
      pagos: {
        Row: {
          created_at: string
          cuenta_id: string
          id: string
          metodo: string
          monto: number
        }
        Insert: {
          created_at?: string
          cuenta_id: string
          id?: string
          metodo: string
          monto: number
        }
        Update: {
          created_at?: string
          cuenta_id?: string
          id?: string
          metodo?: string
          monto?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagos_cuenta_id_fkey"
            columns: ["cuenta_id"]
            isOneToOne: false
            referencedRelation: "cuentas"
            referencedColumns: ["id"]
          },
        ]
      }
      producto_ajustes: {
        Row: {
          agotado: boolean
          precio: number | null
          producto_id: string
          updated_at: string
        }
        Insert: {
          agotado?: boolean
          precio?: number | null
          producto_id: string
          updated_at?: string
        }
        Update: {
          agotado?: boolean
          precio?: number | null
          producto_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      rol_permisos: {
        Row: {
          permisos: string[]
          rol: string
          updated_at: string
        }
        Insert: {
          permisos?: string[]
          rol: string
          updated_at?: string
        }
        Update: {
          permisos?: string[]
          rol?: string
          updated_at?: string
        }
        Relationships: []
      }
      turnos: {
        Row: {
          empleado_id: string
          entrada: string
          id: string
          salida: string | null
        }
        Insert: {
          empleado_id: string
          entrada?: string
          id?: string
          salida?: string | null
        }
        Update: {
          empleado_id?: string
          entrada?: string
          id?: string
          salida?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "turnos_empleado_id_fkey"
            columns: ["empleado_id"]
            isOneToOne: false
            referencedRelation: "empleados"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _admin: {
        Args: { p_pin: string }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          pin_hash: string
          rol: string
        }
        SetofOptions: {
          from: "*"
          to: "empleados"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _empleado_por_pin: {
        Args: { p_pin: string }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          pin_hash: string
          rol: string
        }
        SetofOptions: {
          from: "*"
          to: "empleados"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      _permiso: {
        Args: { p_permiso: string; p_pin: string }
        Returns: {
          activo: boolean
          created_at: string
          id: string
          nombre: string
          pin_hash: string
          rol: string
        }
        SetofOptions: {
          from: "*"
          to: "empleados"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_ajustar_producto: {
        Args: {
          p_admin_pin: string
          p_agotado: boolean
          p_nombre: string
          p_precio: number
          p_producto: string
        }
        Returns: undefined
      }
      admin_cancelar_item: {
        Args: { p_admin_pin: string; p_item: string; p_motivo: string }
        Returns: undefined
      }
      admin_fondo_caja: {
        Args: { p_admin_pin: string; p_fecha: string; p_monto: number }
        Returns: undefined
      }
      admin_guardar_empleado: {
        Args: {
          p_activo: boolean
          p_admin_pin: string
          p_id: string
          p_nombre: string
          p_pin: string
          p_rol: string
        }
        Returns: string
      }
      admin_guardar_mesa: {
        Args: {
          p_activo: boolean
          p_admin_pin: string
          p_id: string
          p_nombre: string
        }
        Returns: undefined
      }
      admin_guardar_permisos: {
        Args: { p_admin_pin: string; p_permisos: string[]; p_rol: string }
        Returns: undefined
      }
      admin_reabrir_cuenta: {
        Args: { p_admin_pin: string; p_cuenta: string; p_motivo: string }
        Returns: undefined
      }
      anular_cuenta: {
        Args: { p_cuenta: string; p_motivo: string }
        Returns: undefined
      }
      cobrar_cuenta: {
        Args: { p_cuenta: string; p_metodo: string }
        Returns: number
      }
      cobrar_cuenta_pagos: {
        Args: { p_cuenta: string; p_pagos: Json; p_propina?: number }
        Returns: number
      }
      enviar_comanda: {
        Args: {
          p_items: Json
          p_mesa: string
          p_mesero?: string
          p_token: string
        }
        Returns: string
      }
      registrar_turno: {
        Args: { p_pin: string; p_tipo: string }
        Returns: undefined
      }
      solicitar_cuenta: { Args: { p_cuenta: string }; Returns: undefined }
      verificar_pin: {
        Args: { p_pin: string }
        Returns: {
          id: string
          nombre: string
          rol: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
