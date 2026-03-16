import ifcopenshell
import ifcopenshell.geom
import sys

def inspect_ifc(file_path):
    print(f"Inspecting {file_path}")
    ifc_file = ifcopenshell.open(file_path)
    
    # Get all products
    products = ifc_file.by_type("IfcProduct")
    print(f"Total products: {len(products)}")
    
    types = {}
    for p in products:
        types[p.is_a()] = types.get(p.is_a(), 0) + 1
        
    print("\nElement types found:")
    for t, count in sorted(types.items(), key=lambda x: x[1], reverse=True):
        print(f"  {t}: {count}")

    print("\nChecking for color/style information...")
    styled_items = ifc_file.by_type("IfcStyledItem")
    print(f"Total styled items: {len(styled_items)}")
    
    if styled_items:
        print("\nExample styles:")
        for i in range(min(5, len(styled_items))):
            styles = styled_items[i].Styles
            for style in styles:
                if style.is_a('IfcPresentationStyleAssignment'):
                    for assigned_style in style.Styles:
                        if assigned_style.is_a('IfcSurfaceStyle'):
                            for element in assigned_style.Styles:
                                if element.is_a('IfcSurfaceStyleRendering'):
                                    color = element.SurfaceColour
                                    print(f"  Found color: R={color.Red}, G={color.Green}, B={color.Blue}")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        inspect_ifc(sys.argv[1])
    else:
        print("Usage: uv run python inspect_ifc.py <path_to_ifc>")
